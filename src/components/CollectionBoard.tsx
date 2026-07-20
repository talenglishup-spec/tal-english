'use client';

/**
 * CollectionBoard — 레벨 도장판 (MVP 중고등)
 *
 * 레벨(S1~)마다 카드 하나. 카드 안에 도장 점(레벨 진행 한눈에) + 표현 목록.
 * 표현 행 상태 3단계: ○ 미학습 → ! 진행 중(시도했으나 미통과) → ✓ 완료.
 * 레벨 내 전 표현 완료 = 레벨 클리어(완료 배지 + 공유) + 다음 레벨 해금.
 * 표현 행 탭 → 그 표현만 바로 연습(부모가 ChallengeDrill 단일 모드 오픈).
 * 잠긴 레벨은 슬림한 한 줄로 접어 목록이 길어지지 않게 한다.
 */

import React, { useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';
import {
  LevelClip, getLevels, clipsOfLevel, isLevelCleared, getUnlockedLevels, getCurrentLevel,
} from '@/lib/levels';

type Props = {
  clips: LevelClip[];
  passedIds: Set<string>;
  attemptedIds: Set<string>;   // 시도(성공 여부 무관) 이력 있는 clip_id
  totalXp: number;
  todayPassedIds?: Set<string>; // 오늘 새로 완료 — 하이라이트
  onPractice: (clip: LevelClip) => void;
};

export default function CollectionBoard({
  clips, passedIds, attemptedIds, totalXp, todayPassedIds, onPractice,
}: Props) {
  const [lockMsg, setLockMsg] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  // 클리어한 레벨 SNS 공유 — Web Share API, 미지원 시 클립보드 복사
  const shareLevel = async (lv: string) => {
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

  const levels = getLevels(clips);
  const unlocked = new Set(getUnlockedLevels(clips, passedIds));
  const currentLevel = getCurrentLevel(clips, passedIds);
  const totalDone = clips.filter(c => passedIds.has(c.clip_id)).length;

  const showLockMsg = (prevLevel: string) => {
    setLockMsg(`${prevLevel} 완료하면 열려요 🔓`);
    setTimeout(() => setLockMsg(''), 1800);
  };

  if (levels.length === 0) {
    return (
      <div className={styles.boardWrap}>
        <p className={styles.boardEmpty}>표현이 아직 준비되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.boardWrap}>
      {/* 상단 요약 — 지금까지 모은 표현 수 + 총 XP */}
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderLeft}>
          <span className={styles.boardHeaderTitle}>내 도장판</span>
          <span className={styles.boardHeaderSub}>
            표현 {totalDone} / {clips.length} 완료
          </span>
        </div>
        <span className={styles.boardXp}>⚡ {totalXp.toLocaleString()} XP</span>
      </div>

      {lockMsg && <div className={styles.boardLockToast}>{lockMsg}</div>}
      {shareMsg && <div className={styles.boardLockToast}>{shareMsg}</div>}

      {levels.map((lv, li) => {
        const members = clipsOfLevel(clips, lv);
        const isUnlocked = unlocked.has(lv);
        const cleared = isLevelCleared(clips, lv, passedIds);
        const doneCount = members.filter(c => passedIds.has(c.clip_id)).length;
        const prevLevel = li > 0 ? levels[li - 1] : '';

        // 잠긴 레벨 — 한 줄로 접어 목록을 짧게 유지
        if (!isUnlocked) {
          return (
            <button
              key={lv}
              type="button"
              className={styles.boardLockedRow}
              onClick={() => showLockMsg(prevLevel)}
            >
              <span className={styles.boardLockedName}>🔒 {lv}</span>
              <span className={styles.boardLockedHint}>{prevLevel} 완료하면 열려요</span>
            </button>
          );
        }

        return (
          <section
            key={lv}
            className={`${styles.boardLevelCard} ${lv === currentLevel ? styles.boardLevelCardCurrent : ''}`}
          >
            <div className={styles.boardLevelHead}>
              <div className={styles.boardLevelHeadLeft}>
                <span className={styles.boardLevelName}>{lv}</span>
                <span className={cleared ? styles.boardStatusDone : styles.boardStatusGoing}>
                  {cleared ? '완료' : '진행 중'}
                </span>
              </div>
              <div className={styles.boardLevelHeadRight}>
                {cleared && (
                  <button type="button" className={styles.boardShareBtn} onClick={() => shareLevel(lv)}>
                    공유
                  </button>
                )}
                <span className={styles.boardLevelCount}>{doneCount}/{members.length}</span>
              </div>
            </div>

            {/* 도장 점 — 레벨 진행을 한눈에 */}
            <div className={styles.boardStamps}>
              {members.map(c => {
                const passed = passedIds.has(c.clip_id);
                const tried = !passed && attemptedIds.has(c.clip_id);
                return (
                  <span
                    key={c.clip_id}
                    className={`${styles.boardStamp} ${
                      passed ? styles.boardStampDone : tried ? styles.boardStampTried : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* 표현 목록 — 영어 + 한글 한 행씩 */}
            <ul className={styles.boardExprList}>
              {members.map(clip => {
                const passed = passedIds.has(clip.clip_id);
                const tried = !passed && attemptedIds.has(clip.clip_id);
                const isToday = todayPassedIds?.has(clip.clip_id);

                return (
                  <li key={clip.clip_id}>
                    <button
                      type="button"
                      className={`${styles.boardExprRow} ${isToday ? styles.boardExprRowToday : ''}`}
                      onClick={() => onPractice(clip)}
                    >
                      <span
                        className={`${styles.boardExprDot} ${
                          passed ? styles.boardExprDotDone : tried ? styles.boardExprDotTried : ''
                        }`}
                      >
                        {passed ? '✓' : tried ? '!' : ''}
                      </span>
                      <span className={styles.boardExprTexts}>
                        <span className={styles.boardExprEn}>{clip.target_phrase}</span>
                        {clip.translation && String(clip.translation).trim() !== '' && (
                          <span className={styles.boardExprKo}>{clip.translation}</span>
                        )}
                      </span>
                      <span className={styles.boardExprChevron}>›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className={styles.boardHint}>표현을 탭하면 바로 연습할 수 있어요</p>
    </div>
  );
}
