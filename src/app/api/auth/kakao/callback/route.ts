import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/utils/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code');
    const errorDescription = searchParams.get('error_description');

    if (errorDescription) {
      console.error('[Kakao Callback] Error Description:', errorDescription);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(errorDescription)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent('No authorization code provided')}`);
    }

    const supabase = getSupabase();
    
    // Authorization Code를 Supabase Session으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[Kakao Callback] Exchange Error:', error.message);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(error.message)}`);
    }

    // 로그인 통과 시 홈(/home)으로 정상 리다이렉트
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/home`);
  } catch (err: any) {
    console.error('[Kakao Callback] Runtime Error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(err.message)}`);
  }
}
