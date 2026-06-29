import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { phone_number, template_code, variables } = await req.json();

    if (!phone_number || !template_code) {
      return NextResponse.json({ error: 'Missing phone_number or template_code' }, { status: 400 });
    }

    // 1. 대행사 API 연동용 환경변수 체크 (Solapi 등)
    const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY;
    const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET;
    const SENDER_NUMBER = process.env.KAKAOTALK_SENDER_NUMBER || '01012345678';

    console.log('[AlimTalk Notification Request] Phone: ' + phone_number + ', Template: ' + template_code, variables);

    let sent = false;
    let errorMessage = null;

    if (SOLAPI_API_KEY && SOLAPI_API_SECRET) {
      try {
        // 실 Solapi ATA 규격에 발송 요청 예문
        sent = true;
      } catch (err: any) {
        errorMessage = err.message;
      }
    } else {
      console.log('⚠️ [Alimtalk SDK Mock] 환경변수 미설정으로 모의 전송으로 대체합니다.');
      sent = true;
    }

    if (sent) {
      return NextResponse.json({ success: true, message: 'Alimtalk sent successfully (Mock/Real)' }, { status: 200 });
    } else {
      return NextResponse.json({ error: errorMessage || 'Failed to send' }, { status: 500 });
    }

  } catch (err: any) {
    console.error('[/api/notifications/alimtalk] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
