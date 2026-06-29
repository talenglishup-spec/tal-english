import { NextRequest, NextResponse } from 'next/server';
import { appendToSheet } from '@/utils/sheets';
import { createClient } from '@/utils/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, period } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const player_id = user.id;

    if (!plan || !period) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. orderId 생성
    const orderId = `TAL-${Date.now()}-${player_id.slice(-6)}`;

    // 2. 금액 계산
    const amount = plan === 'pro' 
      ? (period === 'annual' ? 199000 : 19900)
      : (period === 'annual' ? 99000 : 9900);

    // 3. Google Sheets subscriptions 시트에 pending 레코드 INSERT
    await appendToSheet('subscriptions', {
      order_id: orderId,
      player_id,
      plan,
      period,
      amount,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // 4. 클라이언트에 반환
    return NextResponse.json({
      orderId,
      amount,
      orderName: `TAL ${plan} ${period}`
    });

  } catch (error) {
    console.error('Payment prepare error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
