'use client';

/**
 * CollectionBoard — 레벨 도장판 (MVP 중고등)
 *
 * 레벨(1-1, WARM-1, ENC, REF …)마다 카드 하나. 카드 안에 도장 점 + 표현 목록.
 * 한 칸 = 한 표현 — 같은 표현의 중복 클립(다른 화자·상황)은 묶어서 한 줄.
 * 표현 행 상태 3단계: ○ 미학습 → ! 진행 중(시도했으나 미통과) → ✓ 완료.
 * 레벨 내 전 표현 완료 = 레벨 클리어(완료 배지 + 공유) + 다음 레벨 해금.
 * 표현 행 탭 → 그 표현만 바로 연습(부모가 ChallengeDrill 단일 모드 오픈).
 * 잠긴 레벨은 슬림한 한 줄로 접어 목록이 길어지지 않게 한다.
 */

import React, { useState } from 'react';
import styles from '@/app/shorts/ShortsPage.module.css';
import {
  LevelClip, getLevels, expressionsOfLevel, isExpressionPassed, isLevelCleared,
  getUnlockedLevels, getCurrentLevel, levelLabel, levelProgress,
} from '@/lib/levels';

type Props = {
  clips: LevelClip[];
  passedIds: Set<string>;
  attemptedIds: Set<string>;   // 시도(성공 여부 무관) 이력 있는 clip_id
  todayPassedIds?: Set<string>; // 오늘 새로 완료 — 하이라이트
  /**
   * 표현 탭 → 연습(챌린지) 진입. 챌린지를 노출하지 않는 동안에는 넘기지 않는다.
   * 없으면 표현 행이 정보 표시(탭 불가)로 렌더되어 막다른 탭이 생기지 않는다.
   */
  onPractice?: (clip: LevelClip) => void;
};

export default function CollectionBoard({
  clips, passedIds, attemptedIds, todayPassedIds, onPractice,
}: Props) {
  const [lockMsg, setLockMsg] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  // 클리어한 레벨 SNS 공유 — Web Share API, 미지원 시 클립보드 복사
  const shareLevel = async (lv: string) => {
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://tal-english.vercel.app';
    const text = `⚽ TAL ${levelLabel(lv, clips)} 클리어! 축구로 영어 표현 훈련 중 🔥`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TAL — Take A Leap', text, url });
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
  // 상단 합계도 카드와 같은 단위(표현)로 센다 — 여기만 클립 수로 세면
  // 모든 레벨이 "완료"인데 헤더는 5/51 로 남는다.
  const totals = levels.reduce(
    (acc, lv) => {
      const { done, total } = levelProgress(clips, lv, passedIds);
      return { done: acc.done + done, total: acc.total + total };
    },
    { done: 0, total: 0 },
  );

  const showLockMsg = (prevLevel: string) => {
    setLockMsg(`${levelLabel(prevLevel, clips)} 완료하면 열려요 🔓`);
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
      {/* 상단 요약 — 지금까지 모은 표현 수 */}
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderLeft}>
          <span className={styles.boardHeaderTitle}>학습한 표현</span>
          {/* 제목이 이미 "표현"이라 여기서 또 붙이면 두 번 읽힌다 */}
          <span className={styles.boardHeaderSub}>
            {totals.done} / {totals.total} 완료
          </span>
        </div>
      </div>

      {lockMsg && <div className={styles.boardLockToast}>{lockMsg}</div>}
      {shareMsg && <div className={styles.boardLockToast}>{shareMsg}</div>}

      {levels.map((lv, li) => {
        // 한 칸 = 한 "표현". 같은 표현의 중복 클립(다른 화자·상황)은 묶어서
        // 한 줄로 보여준다 — 도장판에 "Man on!"이 7줄 늘어서지 않도록.
        const members = expressionsOfLevel(clips, lv);
        const isUnlocked = unlocked.has(lv);
        const cleared = isLevelCleared(clips, lv, passedIds);
        const doneCount = members.filter(g => isExpressionPassed(g, passedIds)).length;
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
              <span className={styles.boardLockedName}>🔒 {levelLabel(lv, clips)}</span>
              <span className={styles.boardLockedHint}>{levelLabel(prevLevel, clips)} 완료하면 열려요</span>
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
                <span className={styles.boardLevelName}>{levelLabel(lv, clips)}</span>
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
              {members.map(g => {
                const passed = isExpressionPassed(g, passedIds);
                const tried = !passed && g.clips.some(c => attemptedIds.has(c.clip_id));
                return (
                  <span
                    key={g.key}
                    className={`${styles.boardStamp} ${
                      passed ? styles.boardStampDone : tried ? styles.boardStampTried : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* 표현 목록 — 영어 + 한글 한 행씩 */}
            <ul className={styles.boardExprList}>
              {members.map(g => {
                // 대표 클립으로 표시·연습하고, 상태는 묶음 전체로 판단한다.
                const clip = g.clip;
                const passed = isExpressionPassed(g, passedIds);
                const tried = !passed && g.clips.some(c => attemptedIds.has(c.clip_id));
                const isToday = g.clips.some(c => todayPassedIds?.has(c.clip_id));

                const rowClass = `${styles.boardExprRow} ${isToday ? styles.boardExprRowToday : ''}`;
                const RowTag = onPractice ? 'button' : 'div';

                return (
                  <li key={g.key}>
                    <RowTag
                      {...(onPractice
                        ? { type: 'button' as const, onClick: () => onPractice(clip) }
                        : {})}
                      className={rowClass}
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
                      {onPractice && <span className={styles.boardExprChevron}>›</span>}
                    </RowTag>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {onPractice && <p className={styles.boardHint}>표현을 탭하면 바로 연습할 수 있어요</p>}
    </div>
  );
}
