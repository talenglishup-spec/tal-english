import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

/**
 * 학습 활동 이벤트 수신 — 학습 시간대·요일별 체류시간·지속율 추적용
 *
 * body: {
 *   events:    [{ event, tab?, dwell_ms?, source? }, ...]   → activity_log
 *   clipViews: [{ clip_id, dwell_ms, speak_triggered, speak_completed }, ...] → clip_view_log
 * }
 *   event: 'session_start' | 'tab_dwell' | 'session_end'
 *
 * clipViews는 쇼츠에서 클립이 비활성화될 때(스크롤 이동) 쌓았다가 함께
 * 보낸다 — 클립별 체류시간과 Speak 포기율(버튼만 누르고 녹음 안 함)의 원천.
 *
 * navigator.sendBeacon으로도 호출된다(앱 이탈 시). Beacon은 same-origin
 * 쿠키를 포함하므로 세션 인증이 그대로 작동한다. 미로그인은 조용히 무시
 * (추적 실패가 학습 흐름을 방해하면 안 됨).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const events = Array.isArray(body?.events) ? body.events : [];
    const clipViews = Array.isArray(body?.clipViews) ? body.clipViews : [];
    if (events.length === 0 && clipViews.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // 익명/만료 세션 — 에러 대신 무시 (Beacon 재시도 없음)
      return NextResponse.json({ success: true, inserted: 0 });
    }

    // ── 클립 시청 로그 (있을 때만) ──────────────────────────
    // activity_log와 독립적으로 처리해 한쪽 실패가 다른 쪽을 막지 않게 한다.
    if (clipViews.length > 0) {
      const clipRows = clipViews
        .filter((v: any) => typeof v?.clip_id === 'string' && v.clip_id)
        .slice(0, 50)
        .map((v: any) => ({
          player_id: user.id,
          clip_id: String(v.clip_id).slice(0, 100),
          dwell_ms: Number.isFinite(v.dwell_ms)
            ? Math.min(Math.max(Math.round(v.dwell_ms), 0), 3600 * 1000)
            : null,
          speak_triggered: !!v.speak_triggered,
          speak_completed: !!v.speak_completed,
        }));
      if (clipRows.length > 0) {
        const { error: cvErr } = await supabase.from('clip_view_log').insert(clipRows);
        if (cvErr) console.warn('[/api/track] clip_view_log insert 실패:', cvErr.message);
      }
    }

    if (events.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const VALID = new Set(['session_start', 'tab_dwell', 'session_end']);
    const rows = events
      .filter((e: any) => VALID.has(e?.event))
      .slice(0, 50) // 폭주 방지
      .map((e: any) => ({
        player_id: user.id,
        event: e.event,
        tab: typeof e.tab === 'string' ? e.tab.slice(0, 20) : null,
        dwell_ms: Number.isFinite(e.dwell_ms) ? Math.min(Math.round(e.dwell_ms), 6 * 3600 * 1000) : null,
        source: e.source === 'push' ? 'push' : 'organic',
      }));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const { error } = await supabase.from('activity_log').insert(rows);
    if (error) {
      console.warn('[/api/track] insert 실패:', error.message);
      return NextResponse.json({ success: false }, { status: 200 }); // 재시도 유발 안 함
    }

    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (err: any) {
    console.error('[/api/track] Error:', err);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
