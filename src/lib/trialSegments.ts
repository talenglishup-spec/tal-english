/**
 * 체험단 세그먼트 정의 · 지표 계산
 *
 * 대시보드(클라이언트)에서 학습자 집계 행을 받아 "집단별"로 분해한다.
 * 서버가 아니라 여기서 계산하는 이유: 세그먼트 축을 바꿀 때마다 재요청 없이
 * 즉시 전환되고, 체험단 규모(20~50명)에선 계산량이 무의미하게 작다.
 *
 * ⚠️ 표본 크기: 축을 잘게 쪼개면 칸마다 1~2명이 되어 통계적으로 무의미하다.
 * 그래서 각 축에 "묶어보기(2그룹)"를 기본 제공하고, MIN_CELL 미만 셀은
 * 대시보드에서 "표본 부족"으로 표시한다.
 */

export const MIN_CELL = 5; // 이 인원 미만이면 해석하지 말라고 경고

export type TrialPlayer = {
  player_id: string;
  email: string | null;
  display_name: string | null;
  birth_date: string | null;
  study_years: string | null;
  self_level: string | null;
  notify_opt_in: boolean | null;
  notify_hour: number | null;
  created_at: string | null;
  onboarded_at: string | null;
  level: number | null;
  xp: number | null;
  streak_days: number | null;
  last_active_date: string | null;
  sessions: number;
  totalDwellMs: number;
  tabDwellMs: Record<string, number>;
  activeDates: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  pushSessions: number;
  attempts: number;
  passed: number;
  shortsAttempts: number;
  challengeAttempts: number;
  passedClips: number;
  savedCount: number;
};

export type PlayerClip = {
  player_id: string;
  clip_id: string;
  attempts: number;
  passed: number;
  source: string;
};

// ── 나이 (생년월일 → 만 나이) ────────────────────────────────
export function ageOf(birthDate: string | null, at: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age -= 1;
  return age;
}

// ── 세그먼트 축 정의 ─────────────────────────────────────────
// grouped=true면 2그룹으로 병합(표본 부족 회피), false면 원본 구분.
export type SegmentAxis = 'age' | 'study_years' | 'self_level' | 'notify' | 'progress' | 'activity';

export const AXIS_LABELS: Record<SegmentAxis, string> = {
  age: '나이',
  study_years: '영어 학습기간',
  self_level: '자기평가 자신감',
  notify: '알림 설정',
  progress: '도달 레벨',
  activity: '활동량',
};

const STUDY_LABEL: Record<string, string> = {
  under1: '1년 미만', '1to3': '1~3년', '3to5': '3~5년', over5: '5년 이상',
};
const SELF_LABEL: Record<string, string> = {
  none: '거의 못함', little: '조금', normal: '보통', good: '잘함',
};

/** 학습자를 해당 축의 그룹명으로 분류. null이면 '미응답'. */
export function bucketOf(p: TrialPlayer, axis: SegmentAxis, grouped: boolean, medianSessions = 0): string {
  switch (axis) {
    case 'age': {
      const a = ageOf(p.birth_date);
      if (a == null) return '미응답';
      if (grouped) return a <= 15 ? '15세 이하' : '16세 이상';
      if (a <= 13) return '13세 이하';
      if (a <= 15) return '14~15세';
      if (a <= 17) return '16~17세';
      return '18세 이상';
    }
    case 'study_years': {
      if (!p.study_years) return '미응답';
      if (grouped) return (p.study_years === 'under1' || p.study_years === '1to3') ? '3년 미만' : '3년 이상';
      return STUDY_LABEL[p.study_years] || p.study_years;
    }
    case 'self_level': {
      if (!p.self_level) return '미응답';
      if (grouped) return (p.self_level === 'none' || p.self_level === 'little') ? '자신감 낮음' : '보통 이상';
      return SELF_LABEL[p.self_level] || p.self_level;
    }
    case 'notify':
      return p.notify_opt_in ? '알림 ON' : '알림 OFF';
    case 'progress': {
      // 쇼츠 합격 클립 수로 도달 단계를 근사 (레벨당 5표현 기준)
      const n = p.passedClips;
      if (n === 0) return '시작 전';
      if (grouped) return n >= 5 ? 'S2 이상' : 'S1';
      if (n < 5) return 'S1 진행';
      if (n < 10) return 'S2 진행';
      return 'S3+';
    }
    case 'activity':
      return p.sessions >= Math.max(1, medianSessions) ? '활발' : '저조';
  }
}

// ── 지표 계산 ────────────────────────────────────────────────
export type Metrics = {
  n: number;
  avgSessions: number;
  avgMinutes: number;         // 총 학습(체류) 분
  avgAttempts: number;
  passRate: number;           // 합격률 %
  avgPassedClips: number;
  d1: number; d3: number; d7: number;  // 유지율 %
  avgActiveDays: number;
  savedTotal: number;
};

/** 가입 후 n일째에 활동했는가 (created_at 기준, KST 날짜 비교) */
function retainedOnDay(p: TrialPlayer, day: number): boolean | null {
  if (!p.created_at || p.activeDates.length === 0) return null;
  const base = new Date(new Date(p.created_at).getTime() + 9 * 3600 * 1000);
  const baseDay = base.toISOString().slice(0, 10);
  // 아직 그 날짜가 도래하지 않은 유저는 분모에서 제외한다(과소집계 방지)
  const target = new Date(base.getTime() + day * 86400000).toISOString().slice(0, 10);
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  if (target > todayKst) return null;
  // day일째 "이후에도" 활동했는지 (엄격한 당일 복귀가 아니라 day 이상 잔존)
  return p.activeDates.some(d => d >= target && d !== baseDay) || p.activeDates.includes(target);
}

export function computeMetrics(players: TrialPlayer[]): Metrics {
  const n = players.length;
  if (n === 0) {
    return { n: 0, avgSessions: 0, avgMinutes: 0, avgAttempts: 0, passRate: 0, avgPassedClips: 0, d1: 0, d3: 0, d7: 0, avgActiveDays: 0, savedTotal: 0 };
  }
  const sum = (f: (p: TrialPlayer) => number) => players.reduce((a, p) => a + f(p), 0);
  const attempts = sum(p => p.attempts);
  const passed = sum(p => p.passed);

  const ret = (day: number) => {
    const evaluable = players.map(p => retainedOnDay(p, day)).filter(v => v !== null) as boolean[];
    if (evaluable.length === 0) return 0;
    return Math.round((evaluable.filter(Boolean).length / evaluable.length) * 100);
  };

  return {
    n,
    avgSessions: +(sum(p => p.sessions) / n).toFixed(1),
    avgMinutes: +(sum(p => p.totalDwellMs) / n / 60000).toFixed(1),
    avgAttempts: +(attempts / n).toFixed(1),
    passRate: attempts > 0 ? Math.round((passed / attempts) * 100) : 0,
    avgPassedClips: +(sum(p => p.passedClips) / n).toFixed(1),
    d1: ret(1), d3: ret(3), d7: ret(7),
    avgActiveDays: +(sum(p => p.activeDates.length) / n).toFixed(1),
    savedTotal: sum(p => p.savedCount),
  };
}

/** 축 기준으로 그룹핑 → 그룹명별 지표 */
export function groupMetrics(
  players: TrialPlayer[],
  axis: SegmentAxis,
  grouped: boolean
): { name: string; metrics: Metrics; players: TrialPlayer[] }[] {
  const sessionsSorted = [...players.map(p => p.sessions)].sort((a, b) => a - b);
  const median = sessionsSorted.length ? sessionsSorted[Math.floor(sessionsSorted.length / 2)] : 0;

  const map = new Map<string, TrialPlayer[]>();
  for (const p of players) {
    const k = bucketOf(p, axis, grouped, median);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  return [...map.entries()]
    .map(([name, ps]) => ({ name, metrics: computeMetrics(ps), players: ps }))
    .sort((a, b) => (a.name === '미응답' ? 1 : b.name === '미응답' ? -1 : b.metrics.n - a.metrics.n));
}

/** 선택된 학습자 집합에 대한 클립별 성과 (난이도 파악) */
export type ClipMeta = {
  clip_id: string; phrase: string; level: string; saved: number;
  views?: number; avgDwellSec?: number; speakTriggered?: number; speakCompleted?: number;
};

export function clipStats(
  playerClip: PlayerClip[],
  playerIds: Set<string>,
  clipMeta: ClipMeta[]
) {
  const metaById = new Map(clipMeta.map(m => [m.clip_id, m]));
  const agg = new Map<string, { clip_id: string; attempts: number; passed: number; learners: number }>();
  for (const pc of playerClip) {
    if (!playerIds.has(pc.player_id)) continue;
    if (!agg.has(pc.clip_id)) agg.set(pc.clip_id, { clip_id: pc.clip_id, attempts: 0, passed: 0, learners: 0 });
    const a = agg.get(pc.clip_id)!;
    a.attempts += pc.attempts;
    a.passed += pc.passed;
    a.learners += 1;
  }
  // 시청 기록만 있고 시도가 없는 클립(= 보기만 하고 Speak 안 함)도 표에 남겨야
  // "이 영상에서 이탈한다"를 볼 수 있으므로, 메타 기준으로 합집합을 만든다.
  for (const m of clipMeta) {
    if ((m.views || 0) > 0 && !agg.has(m.clip_id)) {
      agg.set(m.clip_id, { clip_id: m.clip_id, attempts: 0, passed: 0, learners: 0 });
    }
  }

  return [...agg.values()].map(a => {
    const m = metaById.get(a.clip_id);
    const trig = m?.speakTriggered || 0;
    const comp = m?.speakCompleted || 0;
    return {
      ...a,
      phrase: m?.phrase || a.clip_id,
      level: m?.level || '',
      saved: m?.saved || 0,
      views: m?.views || 0,
      avgDwellSec: m?.avgDwellSec || 0,
      speakTriggered: trig,
      abandonRate: trig > 0 ? Math.round(((trig - comp) / trig) * 100) : null,
      passRate: a.attempts > 0 ? Math.round((a.passed / a.attempts) * 100) : 0,
      avgAttempts: a.learners > 0 ? +(a.attempts / a.learners).toFixed(1) : 0,
    };
  });
}
