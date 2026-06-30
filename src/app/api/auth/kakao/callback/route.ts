import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code');
    const errorDescription = searchParams.get('error_description');

    if (errorDescription) {
      console.error('[Kakao Callback] Error Description:', errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent('No authorization code provided')}`
      );
    }

    // createServerClient: 쿠키를 NextResponse에 직접 기록 (Cookie-Drop 방지)
    let res = NextResponse.next({ request: req });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Authorization Code → Supabase Session 교환 (쿠키 자동 기록)
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Kakao Callback] Exchange Error:', error.message);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    // 세션 쿠키를 redirect response에 명시적으로 복사
    const redirectRes = NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/home`);
    res.cookies.getAll().forEach(c => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;

  } catch (err: any) {
    console.error('[Kakao Callback] Runtime Error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=${encodeURIComponent(err.message)}`
    );
  }
}
