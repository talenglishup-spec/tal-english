import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/utils/supabaseServer';
import { getSupabaseAdmin } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/players
 * 관리자 전용 — 전체 학습자의 대시보드(레벨/XP/요일 스트릭)를 반환.
 * player_dashboard 뷰는 RLS상 본인 행만 조회되므로, 전체 조회는
 * service-role 클라이언트로 수행한다. (requireStaffAuth로 관리자만 접근)
 */
export async function GET() {
  const auth = await requireStaffAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = getSupabaseAdmin();
    // 주의: player_dashboard 뷰에는 subscription_* 컬럼이 없다(뷰 미갱신).
    const { data, error } = await supabase
      .from('player_dashboard')
      .select('player_id, email, display_name, avatar_url, level, xp, xp_to_next, streak_days, streak_week, last_active_date, updated_at')
      .order('streak_days', { ascending: false });

    if (error) {
      console.error('[admin/players] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ players: data || [] });
  } catch (e: any) {
    console.error('[admin/players] error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
