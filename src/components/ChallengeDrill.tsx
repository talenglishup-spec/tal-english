'use client';

/**
 * ChallengeDrill — 오늘의 랜덤 드릴 (MVP 중고등)
 *
 * "배운 표현을 랜덤 5개 말하고, 정답이면 완료 체크 / 오답이면 나중에 다시"
 *
 * 플로우: 시작 → [표현 N/5: 오디오 자동재생 → 녹음 → 판정 → ✅/⚠️ 연출] ×5
 *        → 결과 화면 (골 애니메이션 · XP 카운트업 · 정답 n/5 · 스트릭 · 한판 더)
 *
 * - 판정: /api/train/speak-score (전 단어 인식 = 합격, 점수 숫자 미사용/미표시)
 * - XP:   /api/challenge/complete RPC (첫정답 +15 / 세션완료 +10 / 레벨클리어 +100,
 *         중복 지급은 서버 가드)
 * - singleClip 모드: Collection 카드 탭 → 그 표현 1문항만 (세션 보상 없음)
 */

import React, { useEffect, useRef, useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';
import {
  LevelClip, pickDrillItems, clipsOfLevel, isLevelCleared,
} from '@/lib/levels';

const PRAISE = ['Great!', 'Awesome!', 'Perfect!', 'Nice one!'];
const ENCOURAGE = ['Try again next time!', "You'll get it!", 'Keep going!'];
const SESSION_SIZE = 5;
const REC_MAX_SEC = 8;
const FEEDBACK_MS = 1400;

type Stage = 'start' | 'question' | 'feedback' | 'celebrate' | 'result';

// 셀레브레이션 종이 꽃가루 색 (TAL 블루 + 골드 + 그린)
const CONFETTI_COLORS = ['#0A228F', '#2563eb', '#fbbf24', '#f59e0b', '#10b981', '#93c5fd'];

type Props = {
  clips: LevelClip[];              // speak 가능한 전체 클립 (level 포함)
  passedIds: Set<string>;          // 정답 1회 이상 말한 clip_id
  singleClip?: LevelClip | null;   // Collection 재도전: 이 표현만 1문항
  onExit: () => void;
  // 부모 상태 갱신 (도장판/진행표시 즉시 반영) — 시도/합격 모두 통지
  onResult: (clipId: string, passed: boolean) => void;
};

export default function ChallengeDrill({ clips, passedIds, singleClip, onExit, onResult }: Props) {
  const single = !!singleClip;

  const [stage, setStage] = useState<Stage>(single ? 'question' : 'start');
  const [items, setItems] = useState<LevelClip[]>(single && singleClip ? [singleClip] : []);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<('pass' | 'fail')[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [micError, setMicError] = useState('');
  const [cheer, setCheer] = useState(false);

  // 세션 누적 (결과 화면용)
  const [xpEarned, setXpEarned] = useState(0);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [clearedLevel, setClearedLevel] = useState<string | null>(null);
  // finishSession 시점의 최신 값을 읽기 위한 ref 미러 (setState 비동기 레이스 방지)
  const clearedLevelRef = useRef<string | null>(null);
  const [xpShown, setXpShown] = useState(0); // 카운트업 표시값
  const [shareMsg, setShareMsg] = useState('');

  // 세션 중 새로 합격한 clip_id (레벨 클리어 판정에 passedIds와 합산)
  const sessionPassedRef = useRef<Set<string>>(new Set());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const advanceTimerRef = useRef<any>(null);

  const current = items[idx];

  // ── 정리 ─────────────────────────────────────────────
  const cleanup = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.onstop = null as any; mediaRecorderRef.current.stop(); } catch (e) {}
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} audioRef.current = null; }
  };
  useEffect(() => cleanup, []);

  // ── 표현 오디오 자동 재생 (문항 진입 시) ──────────────
  useEffect(() => {
    if (stage !== 'question' || !current) return;
    playExpressionAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idx]);

  const playExpressionAudio = () => {
    if (!current) return;
    const accent = typeof window !== 'undefined' ? localStorage.getItem('tal_accent') : null;
    const url = (accent === 'uk' ? current.model_audio_uk : current.model_audio_us)
      || current.model_audio_us || current.model_audio_uk;
    if (!url) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  // ── 세션 시작 ────────────────────────────────────────
  const startSession = () => {
    const picked = pickDrillItems(clips, passedIds, SESSION_SIZE);
    if (picked.length === 0) return;
    sessionPassedRef.current = new Set();
    setItems(picked);
    setIdx(0);
    setResults([]);
    setXpEarned(0);
    setXpShown(0);
    setStreakDays(null);
    setClearedLevel(null);
    clearedLevelRef.current = null;
    setShareMsg('');
    setCheer(false);
    setStage('question');
  };

  // ── 녹음 ─────────────────────────────────────────────
  const startRecording = async () => {
    setMicError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setMicError('마이크 권한을 허용해 주세요');
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        scoreAttempt(blob);
      };
      recorder.start();
      setIsRecording(true);

      let elapsed = 0;
      recTimerRef.current = setInterval(() => {
        elapsed += 1;
        if (elapsed >= REC_MAX_SEC) stopRecording();
      }, 1000);
    } catch (e) {
      setMicError('녹음을 시작할 수 없습니다');
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── 판정 ─────────────────────────────────────────────
  const scoreAttempt = async (blob: Blob) => {
    if (!current) return;
    setIsScoring(true);
    let passed = false;
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'speech.webm');
      formData.append('clip_id', current.clip_id);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/train/speak-score', { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        passed = !!data.passed;
      }
    } catch (e) {
      // 채점 실패는 오답이 아니라 "다시 시도" — 오답 처리하지 않는다
      setIsScoring(false);
      setMicError('채점에 실패했어요. 다시 말해볼까요?');
      return;
    }
    setIsScoring(false);
    await handleVerdict(passed);
  };

  const handleVerdict = async (passed: boolean) => {
    const clip = current;
    setResults(prev => [...prev, passed ? 'pass' : 'fail']);
    setFeedback({
      ok: passed,
      msg: passed
        ? PRAISE[Math.floor(Math.random() * PRAISE.length)]
        : ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)],
    });
    setStage('feedback');

    if (clip) onResult(clip.clip_id, passed);

    if (passed && clip) {
      const firstTime = !passedIds.has(clip.clip_id) && !sessionPassedRef.current.has(clip.clip_id);
      sessionPassedRef.current.add(clip.clip_id);

      if (firstTime) {
        // 첫 정답 XP (+15, 서버 가드)
        try {
          const res = await fetch('/api/challenge/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'first_pass', clip_id: clip.clip_id }),
          });
          if (res.ok) {
            const d = await res.json();
            if (d?.rewarded) setXpEarned(x => x + (d.xpGained || 0));
            if (typeof d?.streakDays === 'number') setStreakDays(d.streakDays);
          }
        } catch (e) {}

        // 레벨 클리어 판정 (passedIds + 세션 합격 합산)
        const lv = (clip.level || '').trim();
        if (lv) {
          const combined = new Set([...passedIds, ...sessionPassedRef.current]);
          if (isLevelCleared(clips, lv, combined)) {
            try {
              const res = await fetch('/api/challenge/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'level_clear', level: lv }),
              });
              if (res.ok) {
                const d = await res.json();
                if (d?.rewarded) {
                  setXpEarned(x => x + (d.xpGained || 0));
                  setClearedLevel(lv);
                  clearedLevelRef.current = lv;
                }
                if (typeof d?.streakDays === 'number') setStreakDays(d.streakDays);
              }
            } catch (e) {}
          }
        }
      }
    }

    // 자동 진행
    advanceTimerRef.current = setTimeout(() => {
      setFeedback(null);
      if (idx + 1 >= items.length) {
        finishSession();
      } else {
        if (idx + 1 === 3) setCheer(true); // 3문항 완료 후 응원
        setIdx(i => i + 1);
        setStage('question');
      }
    }, FEEDBACK_MS);
  };

  const finishSession = async () => {
    if (!single) {
      try {
        const res = await fetch('/api/challenge/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'session_complete' }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.rewarded) setXpEarned(x => x + (d.xpGained || 0));
          if (typeof d?.streakDays === 'number') setStreakDays(d.streakDays);
        }
      } catch (e) {}
    }
    // 이번 세션에서 레벨을 클리어했다면 결과 전에 셀레브레이션 먼저
    setStage(clearedLevelRef.current ? 'celebrate' : 'result');
  };

  // 레벨 클리어 SNS 공유 — Web Share API, 미지원 시 클립보드 복사
  const shareLevelClear = async (lv: string) => {
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://tal-english.vercel.app';
    const text = `⚽ TAL ${lv} 레벨 클리어! 축구로 영어 표현 훈련 중 🔥`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TAL English Up', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareMsg('링크가 복사되었습니다!');
      setTimeout(() => setShareMsg(''), 2000);
    } catch (e) {}
  };

  // ── 결과 화면 XP 카운트업 ─────────────────────────────
  useEffect(() => {
    if (stage !== 'result') return;
    if (xpEarned <= 0) { setXpShown(0); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(xpEarned / 30));
    const t = setInterval(() => {
      cur = Math.min(xpEarned, cur + step);
      setXpShown(cur);
      if (cur >= xpEarned) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, xpEarned]);

  const passCount = results.filter(r => r === 'pass').length;

  // ══════════════════ 렌더 ══════════════════

  // 시작 화면
  if (stage === 'start') {
    const availableCount = pickDrillItems(clips, passedIds, SESSION_SIZE).length;
    return (
      <div className={styles.drillWrap}>
        <div className={styles.drillStartCard}>
          <div className={styles.drillStartIcon}>⚽</div>
          <h2 className={styles.drillStartTitle}>오늘의 랜덤 드릴</h2>
          <p className={styles.drillStartSub}>표현 {Math.min(SESSION_SIZE, availableCount)}개 · 듣고 따라 말하기</p>
          {availableCount === 0 ? (
            <p className={styles.drillStartEmpty}>연습할 표현이 아직 없습니다</p>
          ) : (
            <button type="button" className={styles.drillStartBtn} onClick={startSession}>
              KICK OFF
            </button>
          )}
        </div>
      </div>
    );
  }

  // Phase 2 — 레벨 클리어 셀레브레이션 (결과 화면 진입 전)
  if (stage === 'celebrate' && clearedLevel) {
    const members = clipsOfLevel(clips, clearedLevel);
    return (
      <div className={styles.drillWrap}>
        {/* 종이 꽃가루 */}
        <div className={styles.celebrateConfetti}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={styles.confettiPiece}
              style={{
                left: `${(i * 5.3 + 4) % 96}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${(i % 6) * 0.18}s`,
              }}
            />
          ))}
        </div>

        <div className={styles.celebrateWrap}>
          <div className={styles.celebrateBadge}>🏆</div>
          <h2 className={styles.celebrateTitle}>{clearedLevel} 완료! ⚡</h2>
          <p className={styles.celebrateSub}>표현 {members.length}개 전부 정답! 다음 레벨 해금!</p>

          {/* 모든 칸이 차례로 채워지는 도장판 애니메이션 */}
          <div className={styles.celebrateGrid}>
            {members.map((m, i) => (
              <span
                key={m.clip_id}
                className={styles.celebrateCell}
                style={{ animationDelay: `${0.5 + i * 0.18}s` }}
              >
                ✅
              </span>
            ))}
          </div>

          <span className={styles.celebrateShareMsg}>{shareMsg}</span>
          <div className={styles.drillResultBtns}>
            <button type="button" className={styles.drillBtnGhost} onClick={() => shareLevelClear(clearedLevel)}>
              📣 공유하기
            </button>
            <button type="button" className={styles.drillBtnPrimary} onClick={() => setStage('result')}>
              계속 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (stage === 'result') {
    return (
      <div className={styles.drillWrap}>
        <div className={styles.drillResultCard}>
          <div className={styles.drillGoalAnim}>
            <span className={styles.drillGoalBall}>⚽</span>
            <span className={styles.drillGoalNet}>🥅</span>
          </div>
          <h2 className={styles.drillResultTitle}>
            {single ? '연습 완료 ⚽' : '오늘 세션 완료 ⚽'}
          </h2>
          {clearedLevel && (
            <div className={styles.drillLevelClear}>🏆 {clearedLevel} 클리어! 다음 레벨 해금!</div>
          )}
          <div className={styles.drillResultRow}>
            <div className={styles.drillResultStat}>
              <span className={styles.drillResultNum}>{passCount}/{items.length}</span>
              <span className={styles.drillResultLabel}>정답 ✅</span>
            </div>
            <div className={styles.drillResultStat}>
              <span className={styles.drillResultNum}>+{xpShown}</span>
              <span className={styles.drillResultLabel}>XP</span>
            </div>
            {streakDays !== null && (
              <div className={styles.drillResultStat}>
                <span className={styles.drillResultNum}>{streakDays}일</span>
                <span className={styles.drillResultLabel}>연속 🔥</span>
              </div>
            )}
          </div>
          <div className={styles.drillResultBtns}>
            <button type="button" className={styles.drillBtnGhost} onClick={onExit}>홈으로</button>
            {!single && (
              <button type="button" className={styles.drillBtnPrimary} onClick={startSession}>한판 더?</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 문항/피드백 화면
  if (!current) return null;
  return (
    <div className={styles.drillWrap}>
      {/* 상단: 나가기 + 진행 도트 */}
      <div className={styles.drillTopBar}>
        <button type="button" className={styles.drillExit} onClick={() => { cleanup(); onExit(); }}>✕</button>
        <div className={styles.drillDots}>
          {items.map((_, i) => (
            <span key={i} className={`${styles.drillDot} ${i < results.length ? styles.drillDotDone : ''} ${i === idx && stage === 'question' ? styles.drillDotNow : ''}`} />
          ))}
        </div>
        <span className={styles.drillCount}>{Math.min(idx + 1, items.length)}/{items.length}</span>
      </div>

      {cheer && idx === 3 && stage === 'question' && (
        <div className={styles.drillCheer}>절반 넘었어! 잘하고 있어 💪</div>
      )}

      {/* 표현 */}
      <div className={styles.drillPhraseArea}>
        <button type="button" className={styles.drillReplay} onClick={playExpressionAudio}>🔊</button>
        <div className={styles.drillPhrase}>{current.target_phrase}</div>
        {current.translation && <div className={styles.drillTranslation}>{current.translation}</div>}

        {/* Phase 2 — 상황 그림 + 설명 (시트에 콘텐츠가 채워지면 자동 노출) */}
        {(current.situation_image || current.situation_desc) && (
          <div className={styles.drillSituation}>
            {current.situation_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.drillSituationImg}
                src={current.situation_image}
                alt="상황 그림"
                loading="lazy"
              />
            )}
            {current.situation_desc && (
              <div className={styles.drillSituationDesc}>{current.situation_desc}</div>
            )}
          </div>
        )}
      </div>

      {/* 마이크 */}
      <div className={styles.drillMicArea}>
        {micError && <div className={styles.drillMicError}>{micError}</div>}
        {isScoring ? (
          <div className={styles.drillScoring}>
            <div className={styles.analyzingSpinner} />
            <span className={styles.drillScoringText}>듣는 중...</span>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.drillMicBtn} ${isRecording ? styles.drillMicRecording : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={stage === 'feedback'}
          >
            {isRecording ? '⏹' : '🎙️'}
          </button>
        )}
        <span className={styles.drillMicHint}>
          {isRecording ? '말한 뒤 버튼을 누르세요' : isScoring ? '' : '버튼을 누르고 말하세요'}
        </span>
      </div>

      {/* 정답/오답 오버레이 */}
      {stage === 'feedback' && feedback && (
        <div className={`${styles.drillFeedback} ${feedback.ok ? styles.drillFeedbackOk : styles.drillFeedbackNo}`}>
          <span className={styles.drillFeedbackIcon}>{feedback.ok ? '✅' : '⚠️'}</span>
          <span className={styles.drillFeedbackMsg}>{feedback.msg}</span>
        </div>
      )}
    </div>
  );
}
