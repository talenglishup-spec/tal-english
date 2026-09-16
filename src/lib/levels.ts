/**
 * 표현 레벨 공용 로직 — 쇼츠 정렬 · 챌린지 문항 선정 · Collection 도장판이 공유.
 *
 * 레벨 코드 체계 (구글시트 Clips.level):
 *   "1-1" ~ "4-1"  Main 사다리 — 앞자리=언어 복잡도 단계, 뒷자리=묶음
 *   "WARM-1"~      Track B 워밍업 (Main 사다리를 다 지난 뒤)
 *   "ENC"          Track C 격려
 *   "REF"          Track B 심판 어필
 *   "S1", "S2"     레거시 — Main 사다리에 그대로 흡수
 *   "" 또는 "-"    미배정 — 항상 맨 뒤
 *
 * 규칙:
 *  - 레벨 완료 = 레벨 내 모든 "표현"을 각 1회 이상 정답으로 말함.
 *    같은 표현의 중복 클립(다른 화자·상황)은 한 칸으로 센다 — 중복은 관문이
 *    아니라 노출(같은 말을 여러 억양으로 듣는 효과)이다.
 *  - 다음 레벨은 이전 레벨 완료 후 해금
 *  - 레벨 내 순서는 level_order 라운드로빈 — 같은 슬롯의 중복 클립이 연속으로
 *    쏟아지지 않게 1,2,3,…,1,2,3,… 으로 번갈아 낸다.
 *
 * ※ level 문자열은 어디에도 저장되지 않는다(진행 기록은 clip_id 기준). 레벨
 *   코드를 바꿔도 기존 학습 기록은 그대로 이어진다.
 */

export type LevelClip = {
  clip_id: string;
  target_phrase?: string;
  level?: string;        // "1-1", "WARM-1", "ENC", "REF", ...
  level_order?: number;  // 레벨 내 슬롯 번호 (1~5)
  [key: string]: any;
};

/** 같은 표현의 중복 클립을 묶은 단위 — 도장판 한 칸 · 클리어 판정 한 칸. */
export type ExpressionGroup<T extends LevelClip> = {
  key: string;
  clip: T;      // 대표 클립 (표시·연습 진입용)
  clips: T[];   // 같은 표현의 모든 클립
};

// ── 레벨 정렬 ─────────────────────────────────────────────────
// 밴드로 나눠 Main 사다리 → 워밍업 → 격려 → 심판 어필 → 미배정 순을 보장한다.
const BAND = { MAIN: 0, WARM: 1, ENC: 2, REF: 3, NONE: 9 } as const;
const BAND_SPAN = 1_000_000;
const STAGE_SPAN = 1_000;

/** 레벨 코드 → 정렬 순위(작을수록 앞). 알 수 없는 코드는 미배정과 같이 맨 뒤. */
export function levelRank(level?: string): number {
  const s = (level || '').trim().toUpperCase();
  if (!s || s === '-') return BAND.NONE * BAND_SPAN;

  let m = s.match(/^(\d+)-(\d+)$/);                       // 1-1, 2-3, 4-1
  if (m) return BAND.MAIN * BAND_SPAN + parseInt(m[1], 10) * STAGE_SPAN + parseInt(m[2], 10);

  m = s.match(/^S(\d+)$/);                                // 레거시 S1 → 1단계 선두
  if (m) return BAND.MAIN * BAND_SPAN + parseInt(m[1], 10) * STAGE_SPAN;

  m = s.match(/^WARM-(\d+)$/);                            // WARM-1, WARM-2
  if (m) return BAND.WARM * BAND_SPAN + parseInt(m[1], 10);

  if (s === 'ENC') return BAND.ENC * BAND_SPAN;
  if (s === 'REF') return BAND.REF * BAND_SPAN;
  return BAND.NONE * BAND_SPAN;
}

/**
 * 레벨이 속한 "군" — Main 사다리는 앞자리 숫자("1-10" → "1"),
 * 트랙은 트랙 이름 자체가 군이 된다. 군이 없는 코드는 null.
 */
export function stageKeyOf(level?: string): string | null {
  const s = (level || '').trim().toUpperCase();
  if (!s || s === '-') return null;

  let m = s.match(/^(\d+)-(\d+)$/);
  if (m) return m[1];
  m = s.match(/^S(\d+)$/);
  if (m) return m[1];
  if (/^WARM-\d+$/.test(s)) return 'WARM';
  if (s === 'ENC') return 'ENC';
  if (s === 'REF') return 'REF';
  return null;
}

/** 한 군에 속한 레벨 코드들 — 순서대로. */
export function levelsOfStage(clips: LevelClip[], stageKey: string): string[] {
  return getLevels(clips).filter(l => stageKeyOf(l) === stageKey);
}

/**
 * 화면에 보여줄 레벨 이름. "1-1" → "스텝 1-1", "WARM-2" → "워밍업 2".
 *
 * 시트의 뒷자리 숫자는 정렬·끼워넣기용이라 띄엄띄엄할 수 있다(1-5, 1-10, 1-15
 * 처럼 나중에 사이에 새 묶음을 넣으려고 간격을 비워둔다). 그 숫자를 그대로
 * 보여주면 "스텝 1-10"이 되어 10단계가 있는 것처럼 읽히므로, clips를 넘기면
 * 그 군에서 몇 번째인지를 세어 1,2,3…으로 바꿔 보여준다.
 * clips를 안 넘기면 예전처럼 시트 숫자를 그대로 쓴다.
 */
export function levelLabel(level?: string, clips?: LevelClip[]): string {
  const raw = (level || '').trim();
  const s = raw.toUpperCase();
  if (!s || s === '-') return raw;

  // 같은 군 안에서의 순번 (1부터). clips가 없으면 0 → 시트 숫자로 폴백.
  let seq = 0;
  const stage = stageKeyOf(s);
  if (clips && stage) {
    const i = levelsOfStage(clips, stage).findIndex(l => l.trim().toUpperCase() === s);
    if (i >= 0) seq = i + 1;
  }

  let m = s.match(/^(\d+)-(\d+)$/);
  if (m) return `스텝 ${parseInt(m[1], 10)}-${seq || parseInt(m[2], 10)}`;

  m = s.match(/^S(\d+)$/);
  if (m) return `스텝 ${parseInt(m[1], 10)}`;

  m = s.match(/^WARM-(\d+)$/);
  if (m) return `워밍업 ${seq || parseInt(m[1], 10)}`;

  if (s === 'ENC') return '격려';
  if (s === 'REF') return '심판 어필';
  return raw;
}

/**
 * 레벨 내부 정렬 — level_order 라운드로빈.
 * 슬롯 1이 7개, 슬롯 2가 4개라면 1,2,3,4,5 / 1,2,3,4,5 / 1,2 … 순으로 낸다.
 * 단순 level_order 오름차순으로 정렬하면 같은 표현 7개가 연속으로 나온다.
 */
function roundRobinByOrder<T extends LevelClip>(group: T[]): T[] {
  const slots = new Map<number, T[]>();
  for (const c of group) {
    const k = c.level_order || 0;
    const arr = slots.get(k);
    if (arr) arr.push(c);
    else slots.set(k, [c]);
  }
  const keys = [...slots.keys()].sort((a, b) => a - b);
  const depth = keys.reduce((mx, k) => Math.max(mx, slots.get(k)!.length), 0);

  const out: T[] = [];
  for (let round = 0; round < depth; round++) {
    for (const k of keys) {
      const item = slots.get(k)![round];
      if (item) out.push(item);
    }
  }
  return out;
}

/** 레벨 순 → 레벨 내 level_order 라운드로빈. 미배정은 맨 뒤(원래 순서 유지). */
export function sortClipsByLevel<T extends LevelClip>(clips: T[]): T[] {
  const byLevel = new Map<string, T[]>();
  for (const c of clips) {
    const k = (c.level || '').trim();
    const arr = byLevel.get(k);
    if (arr) arr.push(c);
    else byLevel.set(k, [c]);
  }
  // 순위가 같은(= 알 수 없는) 코드끼리는 Array.sort의 안정성으로 원래 순서 유지
  const keys = [...byLevel.keys()].sort((a, b) => levelRank(a) - levelRank(b));

  const out: T[] = [];
  for (const k of keys) out.push(...roundRobinByOrder(byLevel.get(k)!));
  return out;
}

/** 존재하는 레벨 이름을 순서대로 (예: ['1-1','1-2','WARM-1','ENC','REF']) */
export function getLevels(clips: LevelClip[]): string[] {
  const set = new Set(clips.map(c => (c.level || '').trim()).filter(Boolean));
  return [...set].sort((a, b) => levelRank(a) - levelRank(b));
}

/** 레벨의 전체 클립 — 중복 포함. 쇼츠 피드가 쓰는 목록. */
export function clipsOfLevel<T extends LevelClip>(clips: T[], level: string): T[] {
  return sortClipsByLevel(clips.filter(c => (c.level || '').trim() === level));
}

/** 표현 묶음 키 — 대소문자·문장부호 차이를 무시하고 같은 말을 한 칸으로 본다. */
export function expressionKeyOf(c: LevelClip): string {
  const norm = String(c.target_phrase || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim();
  // 표현이 비면 절대 다른 클립과 합치지 않는다 — clip_id로 자기 자신만의 칸.
  return norm || `@clip:${c.clip_id}`;
}

/**
 * 레벨의 표현 목록 — 중복 클립을 한 칸으로 묶는다.
 * 도장판 한 칸 · 진행률 분모 · 클리어 판정이 모두 이 단위를 쓴다.
 */
export function expressionsOfLevel<T extends LevelClip>(clips: T[], level: string): ExpressionGroup<T>[] {
  const groups = new Map<string, ExpressionGroup<T>>();
  for (const c of clipsOfLevel(clips, level)) {
    const key = expressionKeyOf(c);
    const g = groups.get(key);
    if (g) g.clips.push(c);
    else groups.set(key, { key, clip: c, clips: [c] });
  }
  return [...groups.values()];
}

/**
 * 이미 통과한 "표현"의 키 집합 — 레벨과 무관하게 전체에서 모은다.
 * 같은 표현의 다른 장면을 다시 만났을 때 말하기를 또 요구하지 않으려고 쓴다.
 */
export function passedExpressionKeys(clips: LevelClip[], passedIds: Set<string>): Set<string> {
  const keys = new Set<string>();
  for (const c of clips) {
    if (passedIds.has(c.clip_id)) keys.add(expressionKeyOf(c));
  }
  return keys;
}

/** 표현 묶음이 완료됐는가 — 묶음 안 아무 클립이나 통과하면 완료. */
export function isExpressionPassed<T extends LevelClip>(
  group: ExpressionGroup<T>, passedIds: Set<string>
): boolean {
  return group.clips.some(c => passedIds.has(c.clip_id));
}

/** 레벨 진행률 — 표현 단위 (분모가 클립 수가 아니라 표현 수). */
export function levelProgress(
  clips: LevelClip[], level: string, passedIds: Set<string>
): { done: number; total: number } {
  const groups = expressionsOfLevel(clips, level);
  return {
    done: groups.filter(g => isExpressionPassed(g, passedIds)).length,
    total: groups.length,
  };
}

export function isLevelCleared(clips: LevelClip[], level: string, passedIds: Set<string>): boolean {
  const { done, total } = levelProgress(clips, level, passedIds);
  return total > 0 && done === total;
}

/**
 * 해금된 레벨 목록 — "가장 멀리 깬 레벨"까지 + 그 다음 하나.
 *
 * 예전에는 앞에서부터 훑다가 미클리어 레벨을 만나면 멈췄다. 그러면 콘텐츠를
 * 중간에 끼워 넣는 순간(스텝 사이에 새 스텝을 넣거나, 이미 깬 스텝에 표현을
 * 하나 더 넣거나) 그 레벨이 미클리어로 돌아가면서 **그 뒤 레벨이 전부 다시
 * 잠긴다** — 2-1을 하던 사람이 1-3으로 튕겨 돌아간다. 콘텐츠는 계속 채워
 * 넣을 거라 이 일은 반복해서 생긴다.
 *
 * 그래서 해금선을 "클리어한 레벨 중 가장 뒤"로 잡는다. 한 번 열린 레벨은
 * 콘텐츠가 늘어도 다시 잠기지 않고, 중간에 끼어든 새 스텝은 (미클리어지만)
 * 이미 해금선 안쪽이라 도장판·되돌아가기로 언제든 갈 수 있다.
 * 클리어가 하나도 없으면 첫 레벨만 — 신규 사용자 동작은 그대로다.
 */
export function getUnlockedLevels(clips: LevelClip[], passedIds: Set<string>): string[] {
  const levels = getLevels(clips);
  let frontier = -1; // 클리어한 레벨 중 가장 뒤의 인덱스
  for (let i = 0; i < levels.length; i++) {
    if (isLevelCleared(clips, levels[i], passedIds)) frontier = i;
  }
  return levels.slice(0, Math.min(frontier + 2, levels.length));
}

/**
 * 현재 진행 중 레벨 — 해금된 것 중 가장 뒤.
 * 중간에 새 스텝이 끼어도 진행하던 자리를 지킨다(위 getUnlockedLevels 참고).
 * 끼어든 스텝이 없는 평소에는 "미클리어인 첫 레벨"과 같은 값이다.
 */
export function getCurrentLevel(clips: LevelClip[], passedIds: Set<string>): string | null {
  const unlocked = getUnlockedLevels(clips, passedIds);
  return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
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
