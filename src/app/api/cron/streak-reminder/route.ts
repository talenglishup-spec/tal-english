import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. KST 오늘 날짜 문자열 획득
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = nowKST.getFullYear();
    const mm = String(nowKST.getMonth() + 1).padStart(2, '0');
    const dd = String(nowKST.getDate()).padStart(2, '0');
    const todayKSTStr = yyyy + '-' + mm + '-' + dd;

    // 2. 오늘 아직 학습을 안한 유저 조회
    const { data: statusList, error } = await supabase
      .from('player_status')
      .select('player_id, streak_days')
      .neq('last_active_date', todayKSTStr);

    if (error) {
      console.error('[Cron] Fetch users error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Streak Cron] Found ' + (statusList?.length || 0) + ' users who need reminders.');

    const origin = req.nextUrl.origin;
    let sentCount = 0;

    if (statusList && statusList.length > 0) {
      for (const item of statusList) {
        console.log('[Streak Reminder Push] Triggering Alimtalk for ' + item.player_id);

        try {
          // 실 전화번호 수신을 위한 profile lookup 
          const { data: profile } = await supabase
            .from('player_dashboard')
            .select('display_name')
            .single(); // 실제는 batch 조인을 돌리거나 혹은 user metadata 활용

          // /api/notifications/alimtalk API 실질 호출 연동
          const res = await fetch(origin + '/api/notifications/alimtalk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone_number: '01000000000', // 가상 수신 번호 (실제 전송 테스트 시 바인딩)
              template_code: 'STREAK_REMINDER_01',
              variables: {
                user_name: profile?.display_name || '국가대표 훈련병',
                streak_days: String(item.streak_days)
              }
            })
          });

          if (res.ok) {
            sentCount++;
          }
        } catch (postErr) {
          console.error('[Alimtalk Fetch Error]:', postErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      scannedUsers: statusList?.length || 0,
      sentAlimtalks: sentCount,
      todayKST: todayKSTStr
    }, { status: 200 });

  } catch (err: any) {
    console.error('[/api/cron/streak-reminder] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
