/**
 * 표현 레벨(S1~) 공용 로직 — 쇼츠 정렬 · 챌린지 문항 선정 · Collection 도장판이 공유.
 *
 * 규칙 (MVP 중고등 플랜):
 *  - 레벨 완료 = 레벨 내 모든 표현을 각 1회 이상 정답으로 말함
 *  - 다음 레벨은 이전 레벨 완료 후 해금 (S1 → S2 → ...)
 *  - 레벨 미배정(level 빈 값) 클립은 레벨 체계 밖 (정렬 시 맨 뒤)
 */

export type LevelClip = {
  clip_id: string;
  target_phrase?: string;
  level?: string;        // "S1", "S2", ...
  level_order?: number;  // 1~5
  [key: string]: any;
};

const levelNum = (level?: string): number => {
  const m = (level || '').match(/^S(\d+)$/i);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; // 미배정은 맨 뒤
};

/** S1 → S2 → ... , 레벨 내에서는 level_order 순. 미배정은 원래 순서 유지로 맨 뒤. */
export function sortClipsByLevel<T extends LevelClip>(clips: T[]): T[] {
  return [...clips].sort((a, b) => {
    const ln = levelNum(a.level) - levelNum(b.level);
    if (ln !== 0) return ln;
    return (a.level_order || 0) - (b.level_order || 0);
  });
}

/** 존재하는 레벨 이름을 순서대로 (예: ['S1','S2']) */
export function getLevels(clips: LevelClip[]): string[] {
  const set = new Set(clips.map(c => (c.level || '').trim()).filter(Boolean));
  return [...set].sort((a, b) => levelNum(a) - levelNum(b));
}

export function clipsOfLevel<T extends LevelClip>(clips: T[], level: string): T[] {
  return sortClipsByLevel(clips.filter(c => (c.level || '').trim() === level));
}

export function isLevelCleared(clips: LevelClip[], level: string, passedIds: Set<string>): boolean {
  const members = clipsOfLevel(clips, level);
  return members.length > 0 && members.every(c => passedIds.has(c.clip_id));
}

/** 해금된 레벨 목록 — S1은 항상 해금, 이후는 직전 레벨 클리어 시 */
export function getUnlockedLevels(clips: LevelClip[], passedIds: Set<string>): string[] {
  const levels = getLevels(clips);
  const unlocked: string[] = [];
  for (const lv of levels) {
    unlocked.push(lv);
    if (!isLevelCleared(clips, lv, passedIds)) break; // 여기서 멈춤 — 다음은 잠김
  }
  return unlocked;
}

/** 현재 진행 중 레벨 (해금됐지만 아직 미클리어인 첫 레벨; 전부 클리어면 마지막 레벨) */
export function getCurrentLevel(clips: LevelClip[], passedIds: Set<string>): string | null {
  const levels = getLevels(clips);
  if (levels.length === 0) return null;
  for (const lv of levels) {
    if (!isLevelCleared(clips, lv, passedIds)) return lv;
  }
  return levels[levels.length - 1];
}

/** 챌린지 5문항 선정: 해금 레벨 내 미완료 우선 → 완료 표현으로 채움 (각 그룹 셔플) */
export function pickDrillItems<T extends LevelClip>(
  clips: T[],
  passedIds: Set<string>,
  count: number
): T[] {
  const unlocked = new Set(getUnlockedLevels(clips, passedIds));
  const pool = clips.filter(c => unlocked.has((c.level || '').trim()));
  const incomplete = shuffle(pool.filter(c => !passedIds.has(c.clip_id)));
  const complete = shuffle(pool.filter(c => passedIds.has(c.clip_id)));
  return [...incomplete, ...complete].slice(0, count);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
