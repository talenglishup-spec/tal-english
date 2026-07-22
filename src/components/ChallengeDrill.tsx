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
  LevelClip, pickDrillItems,
} from '@/lib/levels';

const SESSION_SIZE = 5;
const REC_MAX_SEC = 8;

// 채점 후 리뷰 화면 = 쇼츠 speak 채점과 동일한 구성(초록 단어 하이라이트 +
// 미국/영국/내 발음 듣기 + 다시하기/다음). 'review' 단계에서 렌더한다.
type Stage = 'start' | 'question' | 'review' | 'result';
type WordTok = { w: string; ok: boolean };

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
  const [isRecording, setIsRecording] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [micError, setMicError] = useState('');
  const [cheer, setCheer] = useState(false);
  const [revealed, setRevealed] = useState(false); // 영어 표현 공개 여부(탭하면 공개)

  // 리뷰 화면(쇼츠 speak 채점 동일) — 현재 문항 채점 결과
  const [reviewPassed, setReviewPassed] = useState(false);
  const [reviewWords, setReviewWords] = useState<WordTok[]>([]);
  const [myAudioUrl, setMyAudioUrl] = useState('');   // 내 발음 재생용
  const [accent, setAccent] = useState<'us' | 'uk'>(
    (typeof window !== 'undefined' && localStorage.getItem('tal_accent') === 'uk') ? 'uk' : 'us'
  );

  // 세션 누적 (결과 화면용) — 챌린지는 연습이라 레벨 클리어 상태는 없다.
  const [xpEarned, setXpEarned] = useState(0);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [xpShown, setXpShown] = useState(0); // 카운트업 표시값

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
  // 내 발음 blob URL 정리 (언마운트 시)
  useEffect(() => () => { if (myAudioUrl) URL.revokeObjectURL(myAudioUrl); }, [myAudioUrl]);

  // 문항이 바뀌면 영어 표현을 다시 가린다. 오디오는 자동재생하지 않고
  // '🔊 듣기' 버튼을 눌렀을 때만 재생한다(수정 요청 반영).
  useEffect(() => {
    setRevealed(false);
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

  // ── 판정 → 리뷰 진입 (결과 확정은 '다음'을 누를 때) ──────────
  // 쇼츠 speak처럼 채점 직후 결과를 바로 확정/자동진행하지 않고, 리뷰 화면을
  // 띄워 단어별 정답·모범 발음·내 발음을 확인하게 한다. 결과 확정(results
  // 반영·XP·레벨 클리어)은 리뷰에서 '다음'을 누를 때 commitAndNext가 처리한다.
  const scoreAttempt = async (blob: Blob) => {
    if (!current) return;
    setIsScoring(true);
    let passed = false;
    let words: WordTok[] = [];
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'speech.webm');
      formData.append('clip_id', current.clip_id);
      formData.append('mode', 'challenge'); // 연습 — 레벨(passedClips) 미반영, 참여도 데이터로만 기록
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/train/speak-score', { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        passed = !!data.passed;
        words = Array.isArray(data.words) ? data.words : [];
      }
    } catch (e) {
      // 채점 실패는 오답이 아니라 "다시 시도" — 오답 처리하지 않는다
      setIsScoring(false);
      setMicError('채점에 실패했어요. 다시 말해볼까요?');
      return;
    }
    setIsScoring(false);
    // 내 발음 재생용 URL (이전 것 정리)
    const url = URL.createObjectURL(blob);
    setMyAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setReviewPassed(passed);
    setReviewWords(words.length > 0 ? words
      : (current.target_phrase || '').split(' ').filter(Boolean).map(w => ({ w, ok: false })));
    setStage('review');
  };

  // 리뷰: 모범 발음(억양별) 재생 — AI 오디오가 있는 클립만 버튼 노출하므로 안전
  const playModelReview = (which: 'us' | 'uk') => {
    if (!current) return;
    const modelUrl = which === 'uk' ? current.model_audio_uk : current.model_audio_us;
    if (!modelUrl) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} }
    const a = new Audio(modelUrl);
    audioRef.current = a;
    a.play().catch(() => {});
    setAccent(which);
    try { localStorage.setItem('tal_accent', which); } catch (e) {}
  };
  // 리뷰: 내 발음 재생
  const playMineReview = () => {
    if (!myAudioUrl) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} }
    const a = new Audio(myAudioUrl);
    audioRef.current = a;
    a.play().catch(() => {});
  };
  // 리뷰: 다시하기 — 같은 문항을 다시 녹음 (결과 미확정이라 중복 집계 없음)
  const retryQuestion = () => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} }
    setMicError('');
    setStage('question');
  };

  // 리뷰: '다음' — 결과 확정(results·onResult·XP·레벨 클리어) 후 다음 문항/결과로
  const commitAndNext = async () => {
    const clip = current;
    const passed = reviewPassed;
    setResults(prev => [...prev, passed ? 'pass' : 'fail']);
    if (clip) onResult(clip.clip_id, passed);

    if (passed && clip) {
      const firstTime = !passedIds.has(clip.clip_id) && !sessionPassedRef.current.has(clip.clip_id);
      sessionPassedRef.current.add(clip.clip_id);
      if (firstTime) {
        // 첫 정답 보너스 XP (+15, 서버 가드). 챌린지는 연습이라 레벨은 올리지
        // 않지만, 참여 동기부여용 보너스 XP는 유지한다(레벨과 무관한 점수).
        // 레벨 클리어 판정·축하는 쇼츠가 담당하므로 여기서 하지 않는다.
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
      }
    }

    // 다음 문항 / 결과로
    if (idx + 1 >= items.length) {
      finishSession();
    } else {
      if (idx + 1 === 3) setCheer(true); // 3문항 완료 후 응원
      setIdx(i => i + 1);
      setStage('question');
    }
  };

  // ── 넘어가기 (스킵) ──────────────────────────────────
  // 지금 문항을 오답 처리하고 바로 다음 문항으로. 피드백 오버레이 없이 즉시 진행.
  const skipQuestion = () => {
    if (stage !== 'question' || isScoring || isRecording || !current) return;
    setResults(prev => [...prev, 'fail']);
    onResult(current.clip_id, false); // 시도 기록 (오답 → 나중에 다시)
    if (idx + 1 >= items.length) {
      finishSession();
    } else {
      if (idx + 1 === 3) setCheer(true);
      setIdx(i => i + 1);
      setStage('question');
    }
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
    // 챌린지는 레벨 클리어를 판정하지 않으므로 항상 결과 화면으로.
    setStage('result');
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

  // 결과 화면 — 챌린지는 연습 요약(정답 n/5 · 보너스 XP · 스트릭). 레벨 클리어
  // 축하는 쇼츠가 담당하므로 여기서 표시하지 않는다.
  if (stage === 'result') {
    return (
      <div className={styles.drillWrap}>
        <div className={styles.drillResultCard}>
          <div className={styles.drillGoalAnim}>
            <span className={styles.drillGoalBall}>⚽</span>
            <span className={styles.drillGoalNet}>🥅</span>
          </div>
          <h2 className={styles.drillResultTitle}>
            {single ? '연습 완료 ⚽' : '오늘 연습 완료 ⚽'}
          </h2>
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

  // 리뷰 화면 — 쇼츠 speak 채점과 동일 구성(결과 배지 · 초록 단어 하이라이트 ·
  // 미국/영국/내 발음 듣기 · 다시하기/다음). rv* 클래스는 쇼츠 CSS 모듈 공유.
  if (stage === 'review' && current) {
    const lastQuestion = idx + 1 >= items.length;
    return (
      <div className={styles.drillWrap}>
        <div className={styles.drillTopBar}>
          <button type="button" className={styles.drillExit} onClick={() => { cleanup(); onExit(); }}>✕</button>
          <div className={styles.drillProgress}>
            {items.map((_, i) => (
              <span key={i} className={`${styles.drillProgressSeg} ${i <= idx ? styles.drillProgressSegDone : ''}`} />
            ))}
          </div>
          <span className={styles.drillCount}>{idx + 1}/{items.length}</span>
        </div>

        <div className={styles.drillReviewBody}>
          {/* 결과 배지 */}
          <div className={`${styles.rvBadge} ${reviewPassed ? styles.rvBadgePass : styles.rvBadgeMiss}`}>
            {reviewPassed ? '✓' : '↻'}
          </div>
          {/* 영어 표현 — 맞은 단어 초록, 놓친 단어 회색 */}
          <p className={styles.rvPhrase}>
            {reviewWords.map((t, i) => (
              <span key={i} className={`${styles.rvWord} ${t.ok ? styles.rvWordOk : styles.rvWordMiss}`}>{t.w}</span>
            ))}
          </p>
          {current.translation && <p className={styles.rvTranslation}>{current.translation}</p>}

          {/* 듣기 — 왼쪽 미국/영국(있으면), 오른쪽 내 발음 */}
          <div className={styles.rvListenRow}>
            <div className={styles.rvAccentCol}>
              {current.model_audio_us && (
                <button type="button" className={styles.rvListenBtn} onClick={() => playModelReview('us')}>
                  <span className={styles.rvListenIcon}>🔊</span>🇺🇸 미국 발음
                </button>
              )}
              {current.model_audio_uk && (
                <button type="button" className={styles.rvListenBtn} onClick={() => playModelReview('uk')}>
                  <span className={styles.rvListenIcon}>🔊</span>🇬🇧 영국 발음
                </button>
              )}
            </div>
            <button type="button" className={styles.rvListenBtn} disabled={!myAudioUrl} onClick={playMineReview}>
              <span className={styles.rvListenIcon}>▶</span>내 발음
            </button>
          </div>

          <button type="button" className={styles.rvRetryPill} onClick={retryQuestion}>
            <span className={styles.rvRetryIcon}>↻</span>다시하기
          </button>
          <button type="button" className={styles.rvNextText} onClick={commitAndNext}>
            {lastQuestion ? '결과 보기' : '다음 문항으로'}
          </button>
        </div>
      </div>
    );
  }

  // 문항 화면
  if (!current) return null;
  return (
    <div className={styles.drillWrap}>
      {/* 상단: 나가기 + 진행 바 (도트보다 조용하고 한눈에 읽힌다) */}
      <div className={styles.drillTopBar}>
        <button type="button" className={styles.drillExit} onClick={() => { cleanup(); onExit(); }}>✕</button>
        <div className={styles.drillProgress}>
          {items.map((_, i) => (
            <span
              key={i}
              className={`${styles.drillProgressSeg} ${i < results.length ? styles.drillProgressSegDone : ''} ${i === idx && stage === 'question' ? styles.drillProgressSegNow : ''}`}
            />
          ))}
        </div>
        <span className={styles.drillCount}>{Math.min(idx + 1, items.length)}/{items.length}</span>
      </div>

      {cheer && idx === 3 && stage === 'question' && (
        <div className={styles.drillCheer}>절반 넘었어요</div>
      )}

      {/* 문항: 상황 그림 → 상황 배지(위) → 한국어(중심, 크게) → 영어(가림·탭하면 공개) → 듣기 */}
      <div className={styles.drillPhraseArea}>
        {/* 상황 그림 — 있으면 사진, 없으면 자리만 표시(아이콘 + 안내).
            ANTIGRAVITY 생성 이미지가 아직 없는 표현이 많아 빈 자리를 그냥
            건너뛰면 표현마다 레이아웃이 들쭉날쭉해진다. */}
        {current.situation_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.drillSituationImg}
            src={current.situation_image}
            alt="상황 그림"
            loading="lazy"
          />
        ) : (
          <div className={styles.drillSituationPlaceholder}>
            <span className={styles.drillSituationPlaceholderIcon}>⚽</span>
            <span>경기 장면 사진</span>
          </div>
        )}

        {/* 상황 배지 — 파란 필로 컨텍스트를 짧게 */}
        {current.situation_desc && (
          <span className={styles.drillSituationBadge}>{current.situation_desc}</span>
        )}

        {/* 한국어 뜻 — 화면의 시각적 중심 */}
        {current.translation && (
          <div className={styles.drillTransMain}>{current.translation}</div>
        )}

        {/* 영어 표현 — 불투명 가림막으로 가려짐. 탭하면 공개
            (텍스트 자체도 visibility로 숨겨 가림막이 어떤 환경에서도 비치지 않게) */}
        <div
          className={styles.revealWrap}
          role="button"
          tabIndex={0}
          onClick={() => setRevealed(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed(true); }
          }}
        >
          <span className={`${styles.drillPhrase} ${!revealed ? styles.drillPhraseHidden : ''}`}>
            {current.target_phrase}
          </span>
          {!revealed && <span className={styles.revealMask}>탭하여 영어 확인</span>}
        </div>

        {/* 오디오 듣기 — 버튼 눌렀을 때만 재생 */}
        <button type="button" className={styles.drillReplayPill} onClick={playExpressionAudio}>
          <span className={styles.drillReplayIcon}>🔊</span>
          듣기
        </button>
      </div>

      {/* 마이크 */}
      <div className={styles.drillMicArea}>
        {micError && <div className={styles.drillMicError}>{micError}</div>}
        {isScoring ? (
          <div className={styles.drillScoring}>
            <div className={styles.analyzingSpinner} />
            <span className={styles.drillScoringText}>듣는 중</span>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.drillMicBtn} ${isRecording ? styles.drillMicRecording : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? '■' : '🎙️'}
          </button>
        )}
        <span className={styles.drillMicHint}>
          {isRecording ? '다 말했으면 다시 누르세요' : isScoring ? '' : '누르고 말하세요'}
        </span>
        {/* 넘어가기 — 지금 문항을 오답 처리하고 다음으로 */}
        {stage === 'question' && !isRecording && !isScoring && (
          <button type="button" className={styles.drillSkipBtn} onClick={skipQuestion}>
            다음으로 넘어가기
          </button>
        )}
      </div>
    </div>
  );
}
