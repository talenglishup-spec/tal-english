'use client';

/**
 * 온보딩 (/onboarding) — 가입 직후 2단계, 최소 마찰
 *
 *   ① 환영 → ② 알림 받을지 / 언제 (or iOS면 홈화면 추가 안내)
 *
 * 강제 A/B 없이 "전원에게 선택권"을 주고, 유저의 선택이 자연 코호트를 만든다:
 *   - 거부('나중에')            → notify_opt_in=false + onboarded_at set = 대조군
 *   - 추천 시간 그대로 수용      → notify_hour_updated_at NULL
 *   - 직접 시간 변경             → notify_hour_updated_at set
 *
 * 완료 시 profiles.onboarded_at을 찍고 /home으로. 하루 목표 시간은 받지 않음
 * (앱 연동 없이 물으면 안 하느니만 못하므로 의도적으로 제외).
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './OnboardingPage.module.css';
import { getSupabase } from '@/utils/supabase';
import { detectPushEnv, enablePush, setNotifyHour, type PushEnv } from '@/lib/push';

type Step = 'welcome' | 'notify';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabase();

  const [step, setStep] = useState<Step>('welcome');
  const [env, setEnv] = useState<PushEnv | 'loading'>('loading');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hour, setHour] = useState(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setEnv(detectPushEnv());
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/login'); return; }
      setPlayerId(session.user.id);
      // 프로필 행 보장 (온보딩 완료 기록/알림 설정 write가 실패하지 않도록)
      try { await supabase.rpc('ensure_profile'); } catch (e) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 온보딩 완료 처리 → /home
  const finish = async () => {
    try {
      if (playerId) {
        await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', playerId);
      }
      localStorage.setItem('tal_onboarded', '1');
    } catch (e) {}
    router.replace('/home');
  };

  const enableAndFinish = async () => {
    if (!playerId) return;
    setBusy(true);
    setMsg('');
    const r = await enablePush(playerId, supabase);
    if (r.ok) {
      await setNotifyHour(playerId, supabase, hour);
      await finish();
      return;
    }
    setBusy(false);
    if (r.error === 'permission_denied') {
      setMsg('알림 권한이 거부됐어요. 나중에 마이 탭에서 켤 수 있어요.');
    } else {
      setMsg(`알림 설정에 실패했어요. (${r.error}) 나중에 다시 시도할 수 있어요.`);
    }
  };

  // ── 1단계: 환영 ─────────────────────────────
  if (step === 'welcome') {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.dots}><span className={`${styles.dot} ${styles.dotOn}`} /><span className={styles.dot} /></div>
          <div className={styles.hero}>⚽</div>
          <h1 className={styles.title}>환영해요!</h1>
          <p className={styles.sub}>
            축구로 배우는 실전 영어 훈련소 TAL.<br />
            하루 5분, 표현 하나씩 말하면서 시작해요.
          </p>
          <div className={styles.btns}>
            <button type="button" className={styles.primary} onClick={() => setStep('notify')}>
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2단계: 알림 ─────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.dots}><span className={styles.dot} /><span className={`${styles.dot} ${styles.dotOn}`} /></div>
        <div className={styles.hero}>🔔</div>

        {env === 'ios_not_installed' ? (
          <>
            <h1 className={styles.title}>알림을 받으려면</h1>
            <p className={styles.sub}>iPhone은 <b>홈 화면에 추가</b>하면 매일 훈련 알림을 받을 수 있어요.</p>
            <div className={styles.installBox}>
              <ol className={styles.installSteps}>
                <li>Safari 하단 <b>공유 버튼(□↑)</b> 탭</li>
                <li><b>&ldquo;홈 화면에 추가&rdquo;</b> 선택</li>
                <li>홈 화면의 TAL 앱에서 알림 켜기</li>
              </ol>
            </div>
            <div className={styles.btns}>
              <button type="button" className={styles.primary} onClick={finish}>바로 시작하기</button>
            </div>
          </>
        ) : env === 'unsupported' ? (
          <>
            <h1 className={styles.title}>준비 완료!</h1>
            <p className={styles.sub}>이 브라우저는 알림을 지원하지 않아요. 지금 바로 훈련을 시작해요.</p>
            <div className={styles.btns}>
              <button type="button" className={styles.primary} onClick={finish}>시작하기</button>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>매일 훈련 알림 받을래요?</h1>
            <p className={styles.sub}>정한 시간에 &ldquo;오늘의 훈련&rdquo; 알림을 보내드려요. 스트릭 유지에 도움이 돼요.</p>
            <div className={styles.timeBox}>
              <span className={styles.timeLabel}>알림 시간</span>
              <select
                className={styles.timeSelect}
                value={hour}
                onChange={(e) => setHour(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>
            <p className={styles.msg}>{msg}</p>
            <div className={styles.btns}>
              <button type="button" className={styles.primary} disabled={busy} onClick={enableAndFinish}>
                {busy ? '설정 중…' : '🔔 알림 받기'}
              </button>
              <button type="button" className={styles.ghost} onClick={finish}>나중에 할게요</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
