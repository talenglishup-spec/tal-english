import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

/**
 * 웹푸시 구독 등록/해지
 *
 * POST body:
 *   { subscription: PushSubscriptionJSON, userAgent?: string }  → 등록(upsert)
 *   { endpoint: string, unsubscribe: true }                     → 해지(active=false)
 *
 * 한 유저가 여러 기기를 가질 수 있으므로 endpoint 기준 upsert.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    // 해지
    if (body.unsubscribe && body.endpoint) {
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .eq('player_id', user.id)
        .eq('endpoint', body.endpoint);
      if (error) throw error;
      return NextResponse.json({ success: true, unsubscribed: true });
    }

    // 등록
    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        player_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: body.userAgent || '',
        active: true,
      }, { onConflict: 'endpoint' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[/api/push/subscribe] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
