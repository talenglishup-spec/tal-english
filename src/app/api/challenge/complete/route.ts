import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

/**
 * 챌린지 XP 이벤트 처리 (MVP 중고등)
 *
 * body: { event: 'first_pass' | 'session_complete' | 'level_clear',
 *         clip_id?: string, level?: string }
 *
 * 실제 지급/중복 가드는 Supabase RPC complete_challenge_event가 원자적으로
 * 처리한다 (migration 006). first_pass는 speak_attempts_log의 실제 합격
 * 기록을 서버에서 검증하므로 클라이언트 조작으로 XP를 얻을 수 없다.
 */
export async function POST(req: NextRequest) {
  try {
    const { event, clip_id, level } = await req.json();

    if (!event || !['first_pass', 'session_complete', 'level_clear'].includes(event)) {
      return NextResponse.json({ error: 'invalid event' }, { status: 400 });
    }
    if (event === 'first_pass' && !clip_id) {
      return NextResponse.json({ error: 'clip_id required' }, { status: 400 });
    }
    if (event === 'level_clear' && !level) {
      return NextResponse.json({ error: 'level required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    // KST 날짜/요일 인덱스 (기존 train/complete와 동일 규칙)
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = nowKST.getFullYear();
    const mm = String(nowKST.getMonth() + 1).padStart(2, '0');
    const dd = String(nowKST.getDate()).padStart(2, '0');
    const todayKSTStr = `${yyyy}-${mm}-${dd}`;
    const day = nowKST.getDay();
    const kstIdx = day === 0 ? 6 : day - 1; // 0: 월 ... 6: 일

    const { data, error } = await supabase.rpc('complete_challenge_event', {
      p_player_id: user.id,
      p_event: event,
      p_clip_id: clip_id || '',
      p_level: level || '',
      p_today_kst: todayKSTStr,
      p_kst_idx: kstIdx,
    });

    if (error) {
      console.error('[RPC complete_challenge_event Error]:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('[/api/challenge/complete] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
