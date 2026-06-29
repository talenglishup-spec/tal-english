import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { card_id } = await req.json();

    if (!card_id) {
      return NextResponse.json({ error: 'Missing card_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    // KST 날짜 계산
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = nowKST.getFullYear();
    const mm = String(nowKST.getMonth() + 1).padStart(2, '0');
    const dd = String(nowKST.getDate()).padStart(2, '0');
    const todayKSTStr = yyyy + '-' + mm + '-' + dd;

    const day = nowKST.getDay();
    const kstIdx = day === 0 ? 6 : day - 1; // 0: 월요일, ..., 6: 일요일

    // complete_daily_workout RPC stored function 호출
    const { data, error } = await supabase.rpc('complete_daily_workout', {
      p_player_id: user.id,
      p_card_id: card_id,
      p_today_kst: todayKSTStr,
      p_kst_idx: kstIdx
    });

    if (error) {
      console.error('[RPC complete_daily_workout Error]:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (err: any) {
    console.error('[/api/daily/workout-complete] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
