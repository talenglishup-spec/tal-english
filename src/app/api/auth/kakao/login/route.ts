import { NextResponse } from 'next/server';
import { getSupabase } from '@/utils/supabase';

export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Supabase Auth 카카오 OAuth 리다이렉트 주소 획득
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/kakao/callback`,
        queryParams: {
          scope: 'profile_nickname profile_image',
        },
      },
    });

    if (error) {
      console.error('[Kakao Login OAuth] Auth Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.url) {
      return NextResponse.json({ error: 'Failed to generate Kakao OAuth URL' }, { status: 500 });
    }

    return NextResponse.redirect(data.url);
  } catch (err: any) {
    console.error('[Kakao Login OAuth] Runtime Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
