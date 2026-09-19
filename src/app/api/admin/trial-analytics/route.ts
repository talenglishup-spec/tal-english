import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/utils/supabaseServer';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isStaffEmail } from '@/lib/staff';
import { getClipItems } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/trial-analytics
 *
 * 체험단 분석 원천 데이터. 관리자 전용(requireStaffAuth) + service-role로
 * 전체 학습자를 조회한다(RLS는 본인 행만 허용하므로).
 *
 * 설계: "지표를 서버에서 완성해 내려주는" 대신 **학습자 단위로 집계한 행**을
 * 내려주고, 세그먼트 분해·비교는 클라이언트가 한다.
 *   - 세그먼트 축(생년월일/학습기간/자기평가/알림/유입)을 바꿀 때마다 재요청이
 *     필요 없다 → 대시보드에서 축을 즉시 전환할 수 있다.
 *   - 체험단 20~50명 규모에선 전송량이 무의미하게 작다.
 *
 * 분석 대상: 운영진(lib/staff) 제외. ?since=YYYY-MM-DD(KST)를 주면 그날 이전
 * 가입자도 제외한다 — 체험단 시작일을 넣으면 사전 테스트 계정이 빠진다.
 * ?staff=1 이면 운영진도 포함.
 *
 * 모든 표는 1,000행씩 끝까지 넘겨 읽는다(PostgREST 기본 상한이 1,000행이라
 * 한 번에 읽으면 체험단 규모에서 조용히 잘린다).
 *
 * activity_log는 수천 행까지 커지므로 원본을 보내지 않고 서버에서 학습자별·
 * 시간대별로 접어서 보낸다. speak_attempts_log는 (player, clip) 단위로 접어
 * 세그먼트별 클립 난이도를 클라이언트가 계산할 수 있게 한다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC 타임스탬프 → KST 날짜 문자열(YYYY-MM-DD) */
function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
/** UTC 타임스탬프 → KST 시각(0~23) */
function kstHour(iso: string): number {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).getUTCHours();
}

type PlayerAgg = {
  player_id: string;
  email: string | null;
  display_name: string | null;
  // ── 세그먼트 축 ──
  birth_date: string | null;
  study_years: string | null;
  self_level: string | null;
  notify_opt_in: boolean | null;
  notify_hour: number | null;
  created_at: string | null;
  onboarded_at: string | null;
  profile_filled_at: string | null;
  // ── 진행 ──
  level: number | null;
  xp: number | null;
  streak_days: number | null;
  last_active_date: string | null;
  // ── 활동 ──
  sessions: number;
  totalDwellMs: number;
  tabDwellMs: Record<string, number>;
  activeDates: string[];      // 세션이 있었던 KST 날짜 (유지율 계산용)
  firstSeen: string | null;
  lastSeen: string | null;
  pushSessions: number;       // 푸시 유입 세션 수
  // ── 학습 ──
  attempts: number;
  passed: number;
  shortsAttempts: number;
  challengeAttempts: number;
  passedClips: number;        // 합격한 서로 다른 클립 수 (쇼츠 기준)
  savedCount: number;
};

/** 1,000행 상한을 넘어 끝까지 읽는다. 쿼리 객체는 재사용할 수 없어 매번 새로 만든다. */
async function fetchAll<T = any>(make: () => any): Promise<{ data: T[] | null; error: any }> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // 페이지 사이에 행이 빠지거나 겹치지 않게 기본키로 순서를 고정한다(모든 표에 id가 있다)
    const { data, error } = await make().order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) return { data: out.length ? out : null, error };
    out.push(...(data || []));
    if (!data || data.length < PAGE) return { data: out, error: null };
  }
}

export async function GET(req: Request) {
  const auth = await requireStaffAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 병렬 조회 — 서로 의존이 없다
    const [profilesRes, statusRes, activityRes, attemptsRes, savedRes, notifRes, clipsRes, clipViewRes] =
      await Promise.all([
        fetchAll(() => supabase.from('profiles').select(
          'id, email, display_name, created_at, onboarded_at, notify_opt_in, notify_hour, birth_date, study_years, self_level, profile_filled_at'
        )),
        fetchAll(() => supabase.from('player_status').select('player_id, level, xp, streak_days, last_active_date')),
        fetchAll(() => supabase.from('activity_log').select('player_id, event, tab, dwell_ms, source, created_at')),
        fetchAll(() => supabase.from('speak_attempts_log').select('player_id, clip_id, passed, source, created_at')),
        fetchAll(() => supabase.from('saved_clips').select('player_id, clip_id')),
        fetchAll(() => supabase.from('notification_log').select('player_id, sent_at, template_code, cohort, delivered, opened_at, sent_hour_kst')),
        getClipItems().catch(() => []),
        // 마이그레이션 013 미적용 환경에서도 나머지 지표는 나와야 하므로 개별 처리
        fetchAll(() => supabase.from('clip_view_log').select('player_id, clip_id, dwell_ms, speak_triggered, speak_completed')),
      ]);

    // ── 분석 대상 걸러내기 — 운영진·체험단 시작 전 가입자 ────────
    const url = new URL(req.url);
    const since = url.searchParams.get('since');           // YYYY-MM-DD (KST)
    const includeStaff = url.searchParams.get('staff') === '1';
    const allProfiles: any[] = profilesRes.data || [];
    const excluded = new Set<string>(
      allProfiles
        .filter(p => (!includeStaff && isStaffEmail(p.email)) || (since && p.created_at && kstDate(p.created_at) < since))
        .map(p => p.id)
    );
    const keep = (rows: any[] | null) => (rows || []).filter(r => !excluded.has(r.player_id));

    const profiles = allProfiles.filter(p => !excluded.has(p.id));
    const statuses = keep(statusRes.data);
    const activity = keep(activityRes.data);
    const attempts = keep(attemptsRes.data);
    const saved = keep(savedRes.data);
    const notifs = keep(notifRes.data);
    const clipItems: any[] = (clipsRes as any) || [];
    // 013 미적용이면 error가 오고 data는 null — 빈 배열로 낮춰 계속 진행한다
    const clipViews = keep(clipViewRes.data);

    // ── 학습자별 집계 ────────────────────────────────────────
    const statusById = new Map(statuses.map(s => [s.player_id, s]));
    const byPlayer = new Map<string, PlayerAgg>();

    for (const p of profiles) {
      const st: any = statusById.get(p.id) || {};
      byPlayer.set(p.id, {
        player_id: p.id,
        email: p.email ?? null,
        display_name: p.display_name ?? null,
        birth_date: (p as any).birth_date ?? null,
        study_years: (p as any).study_years ?? null,
        self_level: (p as any).self_level ?? null,
        notify_opt_in: p.notify_opt_in ?? null,
        notify_hour: p.notify_hour ?? null,
        created_at: p.created_at ?? null,
        onboarded_at: p.onboarded_at ?? null,
        profile_filled_at: (p as any).profile_filled_at ?? null,
        level: st.level ?? null,
        xp: st.xp ?? null,
        streak_days: st.streak_days ?? null,
        last_active_date: st.last_active_date ?? null,
        sessions: 0,
        totalDwellMs: 0,
        tabDwellMs: {},
        activeDates: [],
        firstSeen: null,
        lastSeen: null,
        pushSessions: 0,
        attempts: 0,
        passed: 0,
        shortsAttempts: 0,
        challengeAttempts: 0,
        passedClips: 0,
        savedCount: 0,
      });
    }

    // 시간대(KST 0~23) · 일자별 버킷
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: 0, attempts: 0 }));
    const dailyMap = new Map<string, { date: string; activeSet: Set<string>; sessions: number; attempts: number; passed: number }>();
    const dayBucket = (d: string) => {
      if (!dailyMap.has(d)) dailyMap.set(d, { date: d, activeSet: new Set(), sessions: 0, attempts: 0, passed: 0 });
      return dailyMap.get(d)!;
    };

    // activity_log → 세션 수, 탭별 체류, 활동 날짜
    const activeDateSets = new Map<string, Set<string>>();
    for (const a of activity) {
      const agg = byPlayer.get(a.player_id);
      if (!agg || !a.created_at) continue;
      const d = kstDate(a.created_at);
      if (!activeDateSets.has(a.player_id)) activeDateSets.set(a.player_id, new Set());

      if (!agg.firstSeen || a.created_at < agg.firstSeen) agg.firstSeen = a.created_at;
      if (!agg.lastSeen || a.created_at > agg.lastSeen) agg.lastSeen = a.created_at;

      if (a.event === 'session_start') {
        agg.sessions += 1;
        if (a.source === 'push') agg.pushSessions += 1;
        activeDateSets.get(a.player_id)!.add(d);
        hourly[kstHour(a.created_at)].sessions += 1;
        const b = dayBucket(d);
        b.sessions += 1;
        b.activeSet.add(a.player_id);
      } else if (a.dwell_ms) {
        agg.totalDwellMs += a.dwell_ms;
        if (a.tab) agg.tabDwellMs[a.tab] = (agg.tabDwellMs[a.tab] || 0) + a.dwell_ms;
      }
    }
    for (const [pid, set] of activeDateSets) {
      const agg = byPlayer.get(pid);
      if (agg) agg.activeDates = [...set].sort();
    }

    // speak_attempts_log → 시도/합격, (player, clip) 집계
    const pcKey = (p: string, c: string) => `${p}||${c}`;
    const playerClip = new Map<string, { player_id: string; clip_id: string; attempts: number; passed: number; source: string }>();
    for (const a of attempts) {
      const agg = byPlayer.get(a.player_id);
      const src = (a as any).source || 'shorts';
      if (agg) {
        agg.attempts += 1;
        if (a.passed) agg.passed += 1;
        if (src === 'shorts') agg.shortsAttempts += 1;
        else agg.challengeAttempts += 1;
      }
      if (a.created_at) {
        hourly[kstHour(a.created_at)].attempts += 1;
        const b = dayBucket(kstDate(a.created_at));
        b.attempts += 1;
        if (a.passed) b.passed += 1;
      }
      const k = pcKey(a.player_id, a.clip_id);
      if (!playerClip.has(k)) {
        playerClip.set(k, { player_id: a.player_id, clip_id: a.clip_id, attempts: 0, passed: 0, source: src });
      }
      const pc = playerClip.get(k)!;
      pc.attempts += 1;
      if (a.passed) pc.passed += 1;
    }

    // 합격한 서로 다른 클립 수 (쇼츠 진행 기준 = 레벨 소스)
    for (const pc of playerClip.values()) {
      if (pc.source === 'shorts' && pc.passed > 0) {
        const agg = byPlayer.get(pc.player_id);
        if (agg) agg.passedClips += 1;
      }
    }

    // saved_clips
    const savedByClip = new Map<string, number>();
    for (const s of saved) {
      const agg = byPlayer.get(s.player_id);
      if (agg) agg.savedCount += 1;
      savedByClip.set(s.clip_id, (savedByClip.get(s.clip_id) || 0) + 1);
    }

    // ── 클립 시청 집계 (체류시간 · Speak 포기율) ─────────────
    const viewAgg = new Map<string, { views: number; dwellMs: number; triggered: number; completed: number }>();
    let totalTriggered = 0, totalCompleted = 0;
    for (const v of clipViews) {
      if (!viewAgg.has(v.clip_id)) viewAgg.set(v.clip_id, { views: 0, dwellMs: 0, triggered: 0, completed: 0 });
      const a = viewAgg.get(v.clip_id)!;
      a.views += 1;
      a.dwellMs += v.dwell_ms || 0;
      if (v.speak_triggered) { a.triggered += 1; totalTriggered += 1; }
      if (v.speak_completed) { a.completed += 1; totalCompleted += 1; }
    }

    // ── 클립 메타(표현 문구·레벨) ────────────────────────────
    const clipMeta = new Map<string, { phrase: string; level: string }>();
    for (const c of clipItems) {
      clipMeta.set(c.clip_id, { phrase: c.target_phrase || c.title_ko || c.clip_id, level: c.level || '' });
    }

    // ── 알림 성과 ───────────────────────────────────────────
    const notifSummary = {
      sent: notifs.length,
      delivered: notifs.filter(n => n.delivered).length,
      opened: notifs.filter(n => n.opened_at).length,
    };

    const daily = [...dailyMap.values()]
      .map(d => ({ date: d.date, activeUsers: d.activeSet.size, sessions: d.sessions, attempts: d.attempts, passed: d.passed }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      filter: { since, includeStaff, excludedCount: excluded.size },
      todayKst: kstDate(new Date().toISOString()),
      players: [...byPlayer.values()],
      playerClip: [...playerClip.values()],
      clipMeta: [...clipMeta.entries()].map(([clip_id, m]) => {
        const v = viewAgg.get(clip_id);
        return {
          clip_id, ...m,
          saved: savedByClip.get(clip_id) || 0,
          views: v?.views || 0,
          avgDwellSec: v && v.views > 0 ? +(v.dwellMs / v.views / 1000).toFixed(1) : 0,
          speakTriggered: v?.triggered || 0,
          speakCompleted: v?.completed || 0,
        };
      }),
      hourly,
      daily,
      notifSummary,
      // Speak 포기율 — 버튼은 눌렀는데 녹음까지 안 간 비율
      speakFunnel: {
        triggered: totalTriggered,
        completed: totalCompleted,
        abandonRate: totalTriggered > 0
          ? Math.round(((totalTriggered - totalCompleted) / totalTriggered) * 100)
          : 0,
        hasData: clipViews.length > 0,
      },
    });
  } catch (e: any) {
    console.error('[trial-analytics] error:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
