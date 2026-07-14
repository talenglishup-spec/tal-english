import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

/**
 * 알림 오픈 기록 — 알림 클릭으로 앱에 진입했을 때 호출.
 * (URL 파라미터 경로와 서비스워커 postMessage 경로 둘 다 여기로 모인다)
 * RLS: 본인 행만 UPDATE 가능하므로 nid 위조로 남의 로그를 못 건드린다.
 */
export async function POST(req: NextRequest) {
  try {
    const { nid } = await req.json();
    if (!nid) return NextResponse.json({ error: 'nid required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    // 최초 오픈만 기록 (이미 opened_at 있으면 유지)
    const { error } = await supabase
      .from('notification_log')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', nid)
      .eq('player_id', user.id)
      .is('opened_at', null);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[/api/push/opened] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
