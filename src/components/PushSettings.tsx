'use client';

/**
 * PushSettings — 마이 탭 학습 알림 설정 (웹푸시)
 *
 * 렌더 분기:
 *  - iOS + 미설치(비 standalone): 알림 토글 대신 "홈 화면 추가 안내"
 *  - 푸시 미지원 브라우저: 안내 문구
 *  - 지원: 알림 토글 + 알림 시간(0~23시 KST) 선택
 *
 * 구독·환경감지·시간저장은 공용 헬퍼(lib/push)로 온보딩과 동작을 공유한다.
 */

import React, { useEffect, useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';
import { getSupabase } from '@/utils/supabase';
import { detectPushEnv, enablePush, disablePush, setNotifyHour, type PushEnv } from '@/lib/push';

export default function PushSettings({ playerId }: { playerId: string | null }) {
  const [env, setEnv] = useState<PushEnv | 'loading'>('loading');
  const [optIn, setOptIn] = useState(false);
  const [hour, setHour] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const supabase = getSupabase();

  useEffect(() => {
    setEnv(detectPushEnv());
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

  const handleEnable = async () => {
    if (!playerId) return;
    setBusy(true);
    setMsg('');
    const r = await enablePush(playerId, supabase);
    if (r.ok) {
      await setNotifyHour(playerId, supabase, hour);
      setOptIn(true);
      setMsg('✅ 알림이 켜졌어요!');
    } else if (r.error === 'permission_denied') {
      setMsg('브라우저 알림 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.');
    } else {
      setMsg(`알림 설정에 실패했어요. (${r.error})`);
    }
    setBusy(false);
  };

  const handleDisable = async () => {
    if (!playerId) return;
    setBusy(true);
    setMsg('');
    const r = await disablePush(playerId, supabase);
    if (r.ok) { setOptIn(false); setMsg('알림을 껐어요'); }
    else setMsg('해지에 실패했어요. 다시 시도해 주세요.');
    setBusy(false);
  };

  const handleHour = async (h: number) => {
    setHour(h);
    if (!playerId) return;
    await setNotifyHour(playerId, supabase, h);
    setMsg(`⏰ 매일 ${h}시에 알려드릴게요`);
  };

  if (env === 'loading') return null;

  // iOS 미설치 — 알림 토글 대신 홈 화면 추가 안내
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
          onClick={optIn ? handleDisable : handleEnable}
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
            onChange={(e) => handleHour(parseInt(e.target.value, 10))}
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
