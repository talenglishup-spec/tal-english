'use client';

/**
 * 온보딩 (/onboarding) — 가입 직후 3단계, 최소 마찰
 *
 *   ① 환영 → ② 프로필 3문항(체험단 집단 구분) → ③ 알림 (or iOS면 홈화면 추가 안내)
 *
 * ②는 체험단 결과를 집단별로 추적하기 위한 최소 정보다. 첫 사용 "전"에 받아야
 * 100% 수집되고 사용 경험이 답변을 오염시키지 않는다. 문항은 3개가 상한이며
 * 전부 버튼/선택으로만 받는다(자유입력은 집계 불가).
 *   - 생년월일        → 나이는 분석 시점에 파생
 *   - 영어 공부 기간  → 학습 이력 세그먼트
 *   - 말하기 자신감   → 앱의 객관 레벨과 대조해 "자신감 vs 실제" 분석
 *
 * 포지션·소속은 선택 항목으로 같은 화면에 추가돼 있다(필수 3문항과 달리 비워도
 * 다음으로 넘어간다). 포지션은 콘텐츠 필터(filterByPosition)가 이미 존재하는데
 * 정작 유저 쪽엔 값이 없어 한 번도 못 쓰였던 것을 메운다. 소속(팀·학교)은 체험단을
 * 나중에 이메일로 일일이 대조하지 않고 가입 시점에 바로 코호트를 태깅하기 위함.
 *
 * 알림은 강제 A/B 없이 "전원에게 선택권"을 주고, 유저의 선택이 자연 코호트를 만든다:
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

type Step = 'welcome' | 'profile' | 'notify';

// 영어 공부 기간 / 말하기 자신감 — 값은 DB에 그대로 저장(집계 키)
const STUDY_YEARS = [
  { v: 'under1', label: '1년 미만' },
  { v: '1to3',   label: '1~3년' },
  { v: '3to5',   label: '3~5년' },
  { v: 'over5',  label: '5년 이상' },
] as const;

const SELF_LEVELS = [
  { v: 'none',   label: '거의 못해요' },
  { v: 'little', label: '조금 해요' },
  { v: 'normal', label: '보통이에요' },
  { v: 'good',   label: '잘해요' },
] as const;

// 선택 항목 — filterByPosition이 기대하는 값과 정확히 맞춰야 한다(예전 /register는
// 'CB'를 썼는데 실제 PositionTag는 'DF'라 필터가 조용히 안 먹혔다).
const POSITIONS = [
  { v: 'FW', label: '공격수' },
  { v: 'MF', label: '미드필더' },
  { v: 'DF', label: '수비수' },
  { v: 'GK', label: '골키퍼' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabase();

  const [step, setStep] = useState<Step>('welcome');
  const [env, setEnv] = useState<PushEnv | 'loading'>('loading');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hour, setHour] = useState(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // ② 프로필 3문항 (체험단 집단 구분) — 필수
  const [birthDate, setBirthDate] = useState('');
  const [studyYears, setStudyYears] = useState('');
  const [selfLevel, setSelfLevel] = useState('');
  // ② 선택 항목 — 비워도 다음으로 넘어간다(profileReady에 포함 안 됨)
  const [position, setPosition] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const profileReady = !!birthDate && !!studyYears && !!selfLevel;

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

  // ② 프로필 저장 → ③ 알림 단계로. 저장 실패해도 온보딩을 막지 않는다
  // (학습 시작이 최우선 — 값은 마이 탭에서 나중에 채울 수 있다).
  const saveProfileAndNext = async () => {
    if (!profileReady) return;
    setBusy(true);
    setProfileMsg('');
    try {
      if (playerId) {
        const { error } = await supabase.from('profiles').update({
          birth_date: birthDate,
          study_years: studyYears,
          self_level: selfLevel,
          // 선택 항목 — 비워두면 빈 문자열이 아니라 null로 저장한다(분석 시
          // "선택 안 함"과 "빈 문자열"을 구분할 필요가 없게).
          position: position || null,
          affiliation: affiliation.trim() || null,
          profile_filled_at: new Date().toISOString(),
        }).eq('id', playerId);
        if (error) throw error;
      }
    } catch (e: any) {
      console.warn('[onboarding] 프로필 저장 실패(계속 진행):', e?.message);
    } finally {
      setBusy(false);
      setStep('notify');
    }
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

  // 진행 점 (3단계)
  const Dots = ({ at }: { at: 0 | 1 | 2 }) => (
    <div className={styles.dots}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`${styles.dot} ${i === at ? styles.dotOn : ''}`} />
      ))}
    </div>
  );

  // ── 1단계: 환영 ─────────────────────────────
  if (step === 'welcome') {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <Dots at={0} />
          <div className={styles.hero}>⚽</div>
          <h1 className={styles.title}>환영해요!</h1>
          <p className={styles.sub}>
            축구로 배우는 실전 영어 훈련소 TAL.<br />
            하루 5분, 표현 하나씩 말하면서 시작해요.
          </p>
          <div className={styles.btns}>
            <button type="button" className={styles.primary} onClick={() => setStep('profile')}>
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2단계: 프로필 3문항 (체험단 집단 구분) ────
  if (step === 'profile') {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <Dots at={1} />
          <div className={styles.hero}>📝</div>
          <h1 className={styles.title}>먼저 알려주세요</h1>
          <p className={styles.sub}>
            딱 3가지만요. 나에게 맞는 훈련을 준비하는 데 쓰여요.
          </p>

          <div className={styles.qBlock}>
            <label className={styles.qLabel} htmlFor="ob-birth">생년월일</label>
            <input
              id="ob-birth"
              type="date"
              className={styles.qDate}
              value={birthDate}
              max="2020-12-31"
              min="1990-01-01"
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className={styles.qBlock}>
            <span className={styles.qLabel}>영어 공부한 기간</span>
            <div className={styles.qOptions}>
              {STUDY_YEARS.map(o => (
                <button
                  key={o.v}
                  type="button"
                  className={`${styles.qOption} ${studyYears === o.v ? styles.qOptionOn : ''}`}
                  onClick={() => setStudyYears(o.v)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.qBlock}>
            <span className={styles.qLabel}>영어 말하기, 지금 어때요?</span>
            <div className={styles.qOptions}>
              {SELF_LEVELS.map(o => (
                <button
                  key={o.v}
                  type="button"
                  className={`${styles.qOption} ${selfLevel === o.v ? styles.qOptionOn : ''}`}
                  onClick={() => setSelfLevel(o.v)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 선택 항목 — 필수 3문항과 시각적으로 분리(구분선 + "선택" 표시).
              비워도 다음 버튼이 그대로 활성화된다(profileReady는 위 3개만 본다). */}
          <div className={styles.optDivider} />

          <div className={styles.qBlock}>
            <label className={styles.qLabel} htmlFor="ob-position">
              포지션 <span className={styles.qOptional}>(선택)</span>
            </label>
            <select
              id="ob-position"
              className={styles.qSelect}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">선택 안 함</option>
              {POSITIONS.map(o => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.qBlock}>
            <label className={styles.qLabel} htmlFor="ob-affiliation">
              소속 팀·학교 <span className={styles.qOptional}>(선택)</span>
            </label>
            <input
              id="ob-affiliation"
              type="text"
              className={styles.qText}
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="예: OO고등학교 축구부"
              maxLength={40}
            />
          </div>

          <p className={styles.msg}>{profileMsg}</p>
          <div className={styles.btns}>
            <button
              type="button"
              className={styles.primary}
              disabled={!profileReady || busy}
              style={!profileReady ? { opacity: 0.45 } : undefined}
              onClick={saveProfileAndNext}
            >
              {busy ? '저장 중…' : profileReady ? '다음' : '3가지를 모두 선택해 주세요'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3단계: 알림 ─────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Dots at={2} />
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
