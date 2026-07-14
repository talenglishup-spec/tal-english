'use client';

/**
 * PushSettings — 마이 탭 학습 알림 설정 (웹푸시)
 *
 * 렌더 분기 (요청 사양 반영):
 *  - iOS + 미설치(비 standalone): 알림 토글 대신 "홈 화면 추가 안내" 렌더링
 *    (iOS는 16.4+ 이면서 홈 화면 설치 상태에서만 웹푸시 동작)
 *  - 푸시 미지원 브라우저: 안내 문구
 *  - 지원: 알림 토글 + 알림 시간(0~23시 KST) 선택
 *
 * 데이터:
 *  - 구독은 /api/push/subscribe (endpoint upsert, 기기별 1행)
 *  - notify_opt_in / notify_hour / notify_hour_updated_at → profiles (RLS own)
 *  - notify_hour_updated_at = "유저가 직접 시간 설정" 코호트 구분자
 */

import React, { useEffect, useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';
import { getSupabase } from '@/utils/supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type Env = 'loading' | 'ios_not_installed' | 'unsupported' | 'ready';

export default function PushSettings({ playerId }: { playerId: string | null }) {
  const [env, setEnv] = useState<Env>('loading');
  const [optIn, setOptIn] = useState(false);
  const [hour, setHour] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const supabase = getSupabase();

  // 환경 감지 — 요청 사양의 standalone 감지 로직 그대로 반영
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as any).standalone);

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;

    const pushSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    if (isIOS && !isStandalone) {
      // iOS는 홈 화면 설치 상태에서만 웹푸시 가능 → 설치 안내 렌더
      setEnv('ios_not_installed');
    } else if (!pushSupported) {
      setEnv('unsupported');
    } else {
      setEnv('ready');
    }
  }, []);

  // 저장된 설정 로드
  useEffect(() => {
    if (!playerId || env !== 'ready') return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notify_opt_in, notify_hour')
          .eq('id', playerId)
          .maybeSingle();
        if (data) {
          setOptIn(!!data.notify_opt_in);
          if (typeof data.notify_hour === 'number') setHour(data.notify_hour);
        }
      } catch (e) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, env]);

  const enablePush = async () => {
    if (!playerId) return;
    setBusy(true);
    setMsg('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMsg('브라우저 알림 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { setMsg('알림 설정이 아직 준비되지 않았습니다. (VAPID 키 미배포)'); return; }

      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      } catch (subErr: any) {
        // 이전에 다른 키로 구독된 적이 있으면 InvalidStateError가 난다
        // (예: 개발 중 다른 VAPID 키로 테스트했던 경우). 기존 구독을 정리하고
        // 현재 키로 한 번 더 시도한다.
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
        throw new Error(`서버 저장 실패 (${res.status}): ${body.error || '알 수 없는 오류'}`);
      }

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ notify_opt_in: true })
        .eq('id', playerId);
      if (profErr) throw new Error(`설정 저장 실패: ${profErr.message}`);

      setOptIn(true);
      setMsg('✅ 알림이 켜졌어요!');
    } catch (e: any) {
      console.error('[PushSettings] enable 실패:', e);
      const detail = e?.name ? `${e.name}: ${e.message}` : (e?.message || '알 수 없는 오류');
      setMsg(`알림 설정에 실패했어요. (${detail})`);
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    if (!playerId) return;
    setBusy(true);
    setMsg('');
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
      setOptIn(false);
      setMsg('알림을 껐어요');
    } catch (e) {
      setMsg('해지에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const changeHour = async (h: number) => {
    setHour(h);
    if (!playerId) return;
    try {
      await supabase.from('profiles').update({
        notify_hour: h,
        notify_hour_updated_at: new Date().toISOString(), // 커스텀 시간 코호트 마킹
      }).eq('id', playerId);
      setMsg(`⏰ 매일 ${h}시에 알려드릴게요`);
    } catch (e) {}
  };

  if (env === 'loading') return null;

  // iOS 미설치 — 알림 토글 대신 홈 화면 추가 안내 컴포넌트
  if (env === 'ios_not_installed') {
    return (
      <div className={styles.myCard}>
        <div className={styles.myCardTitle}>🔔 학습 알림</div>
        <div className={styles.pushInstallGuide}>
          <p className={styles.pushInstallText}>
            iPhone에서 알림을 받으려면 먼저 <b>홈 화면에 추가</b>해 주세요.
          </p>
          <ol className={styles.pushInstallSteps}>
            <li>Safari 하단 <b>공유 버튼(□↑)</b> 탭</li>
            <li><b>&ldquo;홈 화면에 추가&rdquo;</b> 선택</li>
            <li>홈 화면의 TAL 앱을 열고 이곳에서 알림 켜기</li>
          </ol>
        </div>
      </div>
    );
  }

  if (env === 'unsupported') {
    return (
      <div className={styles.myCard}>
        <div className={styles.myCardTitle}>🔔 학습 알림</div>
        <p className={styles.pushInstallText}>이 브라우저는 알림을 지원하지 않아요. Chrome 등 다른 브라우저를 이용해 주세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.myCard}>
      <div className={styles.myCardTitle}>🔔 학습 알림</div>

      <div className={styles.pushRow}>
        <span className={styles.pushLabel}>매일 훈련 리마인더</span>
        <button
          type="button"
          disabled={busy || !playerId}
          onClick={optIn ? disablePush : enablePush}
          className={`${styles.pushToggle} ${optIn ? styles.pushToggleOn : ''}`}
        >
          {busy ? '…' : optIn ? 'ON' : 'OFF'}
        </button>
      </div>

      {optIn && (
        <div className={styles.pushRow}>
          <span className={styles.pushLabel}>알림 시간</span>
          <select
            className={styles.pushHourSelect}
            value={hour}
            onChange={(e) => changeHour(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>{h}:00</option>
            ))}
          </select>
        </div>
      )}

      {msg && <p className={styles.pushMsg}>{msg}</p>}
    </div>
  );
}
