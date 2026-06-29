import { NextRequest, NextResponse } from 'next/server';
import { updateSheetRow, getSheetRow } from '@/utils/sheets';
import { createClient } from '@/utils/supabaseServer';

function calculateUntilDate(period: string): string {
  const date = new Date();
  if (period === 'annual') {
    date.setDate(date.getDate() + 365);
  } else {
    date.setDate(date.getDate() + 30);
  }
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amountStr = searchParams.get('amount');

    if (!paymentKey || !orderId || !amountStr) {
      return NextResponse.redirect(new URL('/payment/fail?reason=missing_params', req.url));
    }

    const amount = Number(amountStr);

    // 1. 토스 서버에 승인 요청 (샌드박스 비밀키 폴백 적용)
    const secretKey = process.env.TOSS_SECRET_KEY || 'test_sk_Z6QXtE111155YodMmvZ3rwYg2wzb';
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    if (!tossResponse.ok) {
      return NextResponse.redirect(new URL('/payment/fail?reason=confirm_failed', req.url));
    }

    const payment = await tossResponse.json();

    // subscriptions 시트 정보 쿼리
    const subscription = await getSheetRow('subscriptions', { order_id: orderId });
    if (!subscription) {
      console.error('Subscription record not found for order:', orderId);
      return NextResponse.redirect(new URL('/payment/fail?reason=not_found', req.url));
    }

    const { player_id, plan, period } = subscription;

    // 2. Google Sheets subscriptions 시트 UPDATE
    await updateSheetRow('subscriptions', { order_id: orderId }, {
      status: 'active',
      payment_key: payment.paymentKey,
      paid_at: payment.approvedAt
    });

    // 3. Google Sheets players 시트 UPDATE
    const untilDate = calculateUntilDate(period);
    await updateSheetRow('Players', { player_id }, {
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_until: untilDate
    });

    // 3-1. Supabase Profiles 테이블 UPDATE (DB 영속화 및 RLS/OVR 최적화 연동)
    const supabase = await createClient();
    const { error: dbUpdateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_plan: plan,
        subscription_until: untilDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', player_id);

    if (dbUpdateError) {
      console.error('[Supabase DB Subscription Sync Failed]:', dbUpdateError.message);
    }

    // 4. n8n WF-08 트리거 (결제 완료 이메일 발송 - 비블로킹 fire-and-forget)
    const n8nWebhook = process.env.N8N_WEBHOOK_PAYMENT_SUCCESS;
    if (n8nWebhook) {
      fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id, plan, period, amount, paid_at: payment.approvedAt })
      }).catch(err => {
        console.error('[n8n welcome email trigger failed]:', err);
      });
    }

    return NextResponse.redirect(new URL('/payment/success?orderId=' + orderId, req.url));

  } catch (error) {
    console.error('Payment confirm error:', error);
    return NextResponse.redirect(new URL('/payment/fail?reason=server_error', req.url));
  }
}
