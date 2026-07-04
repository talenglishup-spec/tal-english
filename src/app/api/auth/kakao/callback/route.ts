import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  // 리다이렉트 기준은 하드코딩 env가 아니라 실제 요청 origin을 사용한다
  // (로컬/프리뷰/프로덕션 어디서든 자기 자신으로 정확히 되돌아가도록).
  const origin = req.nextUrl.origin;
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code');
    const errorDescription = searchParams.get('error_description');

    if (errorDescription) {
      console.error('[Kakao Callback] Error Description:', errorDescription);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('No authorization code provided')}`
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
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    // 세션 쿠키를 redirect response에 명시적으로 복사
    const redirectRes = NextResponse.redirect(`${origin}/home`);
    res.cookies.getAll().forEach(c => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;

  } catch (err: any) {
    console.error('[Kakao Callback] Runtime Error:', err);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(err.message)}`
    );
  }
}
