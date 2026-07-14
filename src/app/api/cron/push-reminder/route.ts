import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import webpush from 'web-push';
import { getSupabaseAdmin } from '@/utils/supabase';

/**
 * 웹푸시 학습 리마인더 — 매시간 정각 실행 (Supabase pg_cron → HTTP 호출)
 *
 * 대상: notify_opt_in = true
 *       AND COALESCE(notify_hour, 20) = 현재 KST 시각
 *       AND 오늘 아직 학습 안 함 (player_status.last_active_date != today)
 *
 * 동작: notification_log INSERT(nid 확보) → 유저의 active 구독 전체에 발송
 *       → 성공 시 delivered=true, 410/404 구독은 active=false로 정리
 *
 * 기존 /api/cron/streak-reminder(목업 알림톡)를 대체한다.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:tal.english.up@gmail.com',
      publicKey,
      privateKey
    );

    const supabase = getSupabaseAdmin();

    // KST 현재 시각/날짜
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hourKST = nowKST.getHours();
    const yyyy = nowKST.getFullYear();
    const mm = String(nowKST.getMonth() + 1).padStart(2, '0');
    const dd = String(nowKST.getDate()).padStart(2, '0');
    const todayKST = `${yyyy}-${mm}-${dd}`;

    // 1) 이 시각에 알림 받기로 한 opt-in 유저
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, notify_hour, notify_hour_updated_at')
      .eq('notify_opt_in', true);
    if (pErr) throw pErr;

    const dueUsers = (profiles || []).filter(
      p => (p.notify_hour ?? 20) === hourKST
    );
    if (dueUsers.length === 0) {
      return NextResponse.json({ success: true, hourKST, due: 0, sent: 0 });
    }

    // 2) 오늘 이미 학습한 유저 제외 + 스트릭 정보
    const ids = dueUsers.map(u => u.id);
    const { data: statuses } = await supabase
      .from('player_status')
      .select('player_id, last_active_date, streak_days')
      .in('player_id', ids);
    const statusMap = new Map((statuses || []).map(s => [s.player_id, s]));

    const targets = dueUsers.filter(u => {
      const s = statusMap.get(u.id);
      return !s || s.last_active_date !== todayKST;
    });

    // 3) 발송
    let sent = 0, cleaned = 0, skippedNoSub = 0;

    for (const user of targets) {
      const s = statusMap.get(user.id);
      const streak = s?.streak_days || 0;
      const name = user.display_name || '선수';

      const template = streak > 0 ? 'STREAK_KEEP' : 'COMEBACK';
      const title = streak > 0
        ? `🔥 ${streak}일 연속 훈련이 끊기기 전에!`
        : '⚽ 오늘의 훈련이 기다리고 있어요';
      const bodyText = streak > 0
        ? `${name}님, 5분이면 오늘 훈련 완료! 스트릭을 지켜요`
        : `${name}님, 표현 5개만 말하면 오늘 훈련 끝!`;

      // active 구독 조회
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('player_id', user.id)
        .eq('active', true);
      if (!subs || subs.length === 0) { skippedNoSub++; continue; }

      // notification_log 먼저 INSERT → nid를 페이로드에 실어 오픈 추적
      const { data: logRow, error: logErr } = await supabase
        .from('notification_log')
        .insert({
          player_id: user.id,
          template_code: template,
          cohort: user.notify_hour_updated_at ? 'custom_time' : 'default_time',
          channel: 'webpush',
          sent_hour_kst: hourKST,
          delivered: false,
        })
        .select('id')
        .single();
      if (logErr || !logRow) { console.error('[push-reminder] log insert 실패:', logErr?.message); continue; }

      const payload = JSON.stringify({ title, body: bodyText, url: '/home', nid: logRow.id });

      let anyDelivered = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          anyDelivered = true;
          await supabase.from('push_subscriptions')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('id', sub.id);
        } catch (err: any) {
          // 만료/폐기된 구독 정리 — 안 하면 발송 지표가 오염된다
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from('push_subscriptions')
              .update({ active: false })
              .eq('id', sub.id);
            cleaned++;
          } else {
            console.error('[push-reminder] send 실패:', err?.statusCode, err?.message);
          }
        }
      }

      if (anyDelivered) {
        await supabase.from('notification_log')
          .update({ delivered: true })
          .eq('id', logRow.id);
        sent++;
      }
    }

    return NextResponse.json({
      success: true, hourKST, todayKST,
      due: dueUsers.length, targeted: targets.length,
      sent, skippedNoSub, cleanedSubscriptions: cleaned,
    });
  } catch (err: any) {
    console.error('[/api/cron/push-reminder] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
