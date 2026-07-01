import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { clip_id, card_id } = await req.json();

    if (!clip_id || !card_id) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    // 1. KST 날짜 계산
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = nowKST.getFullYear();
    const mm = String(nowKST.getMonth() + 1).padStart(2, '0');
    const dd = String(nowKST.getDate()).padStart(2, '0');
    const todayKSTStr = `${yyyy}-${mm}-${dd}`;

    const day = nowKST.getDay();
    const kstIdx = day === 0 ? 6 : day - 1; // 0: 월요일, ..., 6: 일요일

    // 2. Supabase SQL RPC 트랜잭션 함수 1회 호출로 원자적 일괄 처리 및 중복 보상 가드 작동
    const { data, error } = await supabase.rpc('complete_speak_attempt', {
      p_player_id: user.id,
      p_clip_id: clip_id,
      p_card_id: card_id,
      p_today_kst: todayKSTStr,
      p_kst_idx: kstIdx
    });

    if (error) {
      console.error('[RPC complete_speak_attempt Error]:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // RPC가 실제 통과 기록을 찾지 못하면 success:false를 반환한다
    // (speak-score를 거치지 않고 이 엔드포인트를 직접 호출한 경우 등).
    if (data && data.success === false) {
      return NextResponse.json(data, { status: 403 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (err: any) {
    console.error('[/api/train/complete] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
