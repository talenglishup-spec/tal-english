'use client';

/**
 * 웹푸시 공용 헬퍼 — 온보딩(/onboarding)과 마이 탭(PushSettings)이 공유한다.
 * 구독 생성/해지·환경 감지·알림 시간 저장 로직을 한 곳에 두어 두 화면의
 * 동작이 어긋나지 않게 한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PushEnv = 'ios_not_installed' | 'unsupported' | 'ready';

/**
 * 현재 브라우저에서 웹푸시가 가능한 상태인지 판정.
 *  - iOS는 홈 화면 설치(standalone) 상태에서만 웹푸시 가능 → 미설치면 안내 필요
 */
export function detectPushEnv(): PushEnv {
  if (typeof window === 'undefined') return 'unsupported';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone);
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
  const pushSupported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (isIOS && !isStandalone) return 'ios_not_installed';
  if (!pushSupported) return 'unsupported';
  return 'ready';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type EnableResult = { ok: boolean; error?: string };

/** 알림 권한 요청 → 구독 생성 → 서버 저장 → profiles.notify_opt_in = true */
export async function enablePush(
  playerId: string,
  supabase: SupabaseClient
): Promise<EnableResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, error: 'permission_denied' };

    const reg = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return { ok: false, error: 'VAPID 키 미배포' };

    let sub: PushSubscription;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (subErr: any) {
      // 이전에 다른 키로 구독된 흔적이 남아있으면 InvalidStateError → 정리 후 재시도
      if (subErr?.name === 'InvalidStateError') {
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      } else {
        throw subErr;
      }
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `서버 저장 실패 (${res.status}): ${body.error || '알 수 없는 오류'}` };
    }

    const { error } = await supabase.from('profiles').update({ notify_opt_in: true }).eq('id', playerId);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name ? `${e.name}: ${e.message}` : (e?.message || '알 수 없는 오류') };
  }
}

/** 구독 해지 + profiles.notify_opt_in = false */
export async function disablePush(
  playerId: string,
  supabase: SupabaseClient
): Promise<EnableResult> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, unsubscribe: true }),
      });
      await sub.unsubscribe();
    }
    await supabase.from('profiles').update({ notify_opt_in: false }).eq('id', playerId);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || '해지 실패' };
  }
}

/** 알림 시간 저장 — notify_hour_updated_at을 함께 찍어 '직접 설정' 코호트를 마킹 */
export async function setNotifyHour(
  playerId: string,
  supabase: SupabaseClient,
  hour: number
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ notify_hour: hour, notify_hour_updated_at: new Date().toISOString() })
    .eq('id', playerId);
}
