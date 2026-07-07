/**
 * GuideDocent — 홈 탭 AI 코치 도슨트 가이드 (Phase 1 골격)
 *
 * 콘텐츠 형태에 무관하게 동작하도록 GUIDE_STEPS 배열로 구동한다.
 *   - MVP: 종합 가이드 영상 1개.
 *   - 확장: intro/shorts/speak/collection 세그먼트를 배열에 추가하면
 *     스텝 네비게이션(← →, 점 인디케이터)이 자동으로 확장된다.
 *
 * 실제 영상은 Supabase Storage(guide/ 버킷, H.264 mp4, 세로 9:16)에 올린 뒤
 * 각 스텝의 videoUrl만 교체하면 된다. URL이 비어 있으면 "영상 준비 중"
 * 플레이스홀더가 표시된다(골격만 먼저 배포 가능).
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';

export interface GuideStep {
  id: string;
  title: string;
  caption: string;
  /** Supabase Storage 공개 URL (H.264 mp4). 비어 있으면 플레이스홀더 표시. */
  videoUrl: string;
}

// Phase 1: 종합 가이드 영상 1개. 실제 URL 나오면 videoUrl만 교체.
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'overview',
    title: 'TAL 사용법 한눈에',
    // 이 한 영상에 담을 내용(홈 스텝 박스에서 통합):
    //  1) 쇼츠 모드로 귀 트기 — 실제 인터뷰 1x→0.75x→0.5x 감속 반복 쉐도잉
    //  2) Speak 버튼으로 발화 훈련 — 지정 시점 자동 정지, 단어별 발음 채점,
    //     내 발음 vs 모범 답안 비교
    //  3) 선수 카드 수집 — 채점 통과 시 FUT 스타일 카드 해금, 구단 테마 커스텀
    //  4) 매일 훈련하고 성장 — XP·레벨·연속 스트릭, 마이 탭에서 성장 기록 확인
    caption: 'AI 코치가 ① 쇼츠 쉐도잉으로 귀 트기 ② Speak 버튼 발화 훈련(단어별 채점·모범답안 비교) ③ 선수 카드 수집 ④ 매일 성장(XP·레벨·스트릭)까지, 앱 사용법 전체를 한 영상으로 안내합니다.',
    videoUrl: '', // TODO: Supabase Storage guide/ 버킷 URL로 교체
  },
];

const SEEN_KEY = 'tal_guide_seen';

export default function GuideDocent() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [seen, setSeen] = useState(true); // 초기엔 true로 두어 SSR 깜빡임 방지
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setSeen(localStorage.getItem(SEEN_KEY) === '1');
  }, []);

  const step = GUIDE_STEPS[idx] || GUIDE_STEPS[0];
  const multi = GUIDE_STEPS.length > 1;

  const markSeen = () => {
    if (!seen) {
      localStorage.setItem(SEEN_KEY, '1');
      setSeen(true);
    }
  };

  const openGuide = () => {
    setIdx(0);
    setOpen(true);
    markSeen();
  };

  const closeGuide = () => {
    try { videoRef.current?.pause(); } catch (e) {}
    setOpen(false);
  };

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(GUIDE_STEPS.length - 1, next));
    setIdx(clamped);
  };

  // 접힌 카드
  if (!open) {
    return (
      <button type="button" className={styles.guideCard} onClick={openGuide}>
        <div className={styles.guideAvatar}>🎓</div>
        <div className={styles.guideCardText}>
          <div className={styles.guideCardTitle}>
            AI 코치 가이드
            {!seen && <span className={styles.guideNewBadge}>NEW</span>}
          </div>
          <div className={styles.guideCardSub}>앱 사용법을 영상으로 확인하세요</div>
        </div>
        <span className={styles.guidePlayChip}>▶ 보기</span>
      </button>
    );
  }

  // 펼친 플레이어
  return (
    <div className={styles.guidePlayerCard}>
      <div className={styles.guidePlayerHeader}>
        <span className={styles.guidePlayerTitle}>🎓 {step.title}</span>
        <button type="button" className={styles.guideClose} onClick={closeGuide}>✕</button>
      </div>

      <div className={styles.guideVideoBox}>
        {step.videoUrl ? (
          <video
            ref={videoRef}
            key={step.id}
            className={styles.guideVideo}
            src={step.videoUrl}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className={styles.guidePlaceholder}>
            <span className={styles.guidePlaceholderIcon}>🎬</span>
            <span>가이드 영상 준비 중</span>
            <span className={styles.guidePlaceholderSub}>곧 AI 코치 영상이 올라옵니다</span>
          </div>
        )}
      </div>

      <p className={styles.guideCaption}>{step.caption}</p>

      {multi && (
        <div className={styles.guideNav}>
          <button type="button" className={styles.guideNavBtn} disabled={idx === 0} onClick={() => go(idx - 1)}>← 이전</button>
          <div className={styles.guideDots}>
            {GUIDE_STEPS.map((s, i) => (
              <span key={s.id} className={`${styles.guideDot} ${i === idx ? styles.guideDotOn : ''}`} />
            ))}
          </div>
          <button type="button" className={styles.guideNavBtn} disabled={idx === GUIDE_STEPS.length - 1} onClick={() => go(idx + 1)}>다음 →</button>
        </div>
      )}
    </div>
  );
}
