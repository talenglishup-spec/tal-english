import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

/**
 * 학습 활동 이벤트 수신 — 학습 시간대·요일별 체류시간·지속율 추적용
 *
 * body: { events: [{ event, tab?, dwell_ms?, source? }, ...] }
 *   event: 'session_start' | 'tab_dwell' | 'session_end'
 *
 * navigator.sendBeacon으로도 호출된다(앱 이탈 시). Beacon은 same-origin
 * 쿠키를 포함하므로 세션 인증이 그대로 작동한다. 미로그인은 조용히 무시
 * (추적 실패가 학습 흐름을 방해하면 안 됨).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const events = Array.isArray(body?.events) ? body.events : [];
    if (events.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // 익명/만료 세션 — 에러 대신 무시 (Beacon 재시도 없음)
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
