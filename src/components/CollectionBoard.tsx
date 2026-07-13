'use client';

/**
 * CollectionBoard — 레벨 도장판 (MVP 중고등)
 *
 * 레벨(S1~)별 표현 카드 그리드. 카드 상태 3단계:
 *   ⬜ 미학습(회색·🔒) → 🟡 진행 중(주황·❗) → 🟢 완료(초록·✅)
 * 레벨 내 전 표현 완료 = 레벨 클리어(금테 배지) + 다음 레벨 해금.
 * 카드 탭 → 해당 표현만 바로 연습(부모가 ChallengeDrill 단일 모드 오픈).
 * 잠긴 레벨 탭 → "이전 레벨 완료하면 열려!" 안내.
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

  const levels = getLevels(clips);
  const unlocked = new Set(getUnlockedLevels(clips, passedIds));
  const currentLevel = getCurrentLevel(clips, passedIds);

  const showLockMsg = (prevLevel: string) => {
    setLockMsg(`${prevLevel} 완료하면 열려! 🔓`);
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
      {/* 상단: 현재 레벨 + 총 XP */}
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderLevel}>
          <span className={styles.boardLevelChip}>{currentLevel || levels[0]}</span>
          <span className={styles.boardHeaderTitle}>내 도장판</span>
        </div>
        <div className={styles.boardXp}>⚡ {totalXp.toLocaleString()} XP</div>
      </div>

      {lockMsg && <div className={styles.boardLockToast}>{lockMsg}</div>}

      {levels.map((lv, li) => {
        const members = clipsOfLevel(clips, lv);
        const isUnlocked = unlocked.has(lv);
        const cleared = isLevelCleared(clips, lv, passedIds);
        const doneCount = members.filter(c => passedIds.has(c.clip_id)).length;
        const prevLevel = li > 0 ? levels[li - 1] : '';

        return (
          <div key={lv} className={`${styles.boardLevel} ${!isUnlocked ? styles.boardLevelLocked : ''}`}>
            <div className={styles.boardLevelHead}>
              <span className={`${styles.boardLevelName} ${cleared ? styles.boardLevelNameClear : ''}`}>
                {cleared ? '🏆 ' : ''}{lv}
                {!isUnlocked && ' 🔒'}
              </span>
              <span className={styles.boardLevelCount}>{doneCount}/{members.length}</span>
            </div>

            <div className={styles.boardGrid}>
              {members.map(clip => {
                const passed = passedIds.has(clip.clip_id);
                const attempted = !passed && attemptedIds.has(clip.clip_id);
                const isToday = todayPassedIds?.has(clip.clip_id);
                const stateClass = passed
                  ? styles.boardCardDone
                  : attempted
                    ? styles.boardCardTried
                    : styles.boardCardNew;

                return (
                  <button
                    key={clip.clip_id}
                    type="button"
                    className={`${styles.boardCard} ${stateClass} ${isToday ? styles.boardCardToday : ''}`}
                    onClick={() => {
                      if (!isUnlocked) { showLockMsg(prevLevel); return; }
                      onPractice(clip);
                    }}
                  >
                    <span className={styles.boardCardIcon}>
                      {passed ? '✅' : attempted ? '❗' : isUnlocked ? '🎙️' : '🔒'}
                    </span>
                    <span className={styles.boardCardPhrase}>
                      {isUnlocked ? clip.target_phrase : '???'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className={styles.boardHint}>카드를 탭하면 그 표현만 바로 연습할 수 있어요</p>
    </div>
  );
}
