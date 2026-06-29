import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  
  // 보호 예외 공용 및 정적 파일 경로 식별
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isApiRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/api/content');
  const isStatic = pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/);

  // 비인증 사용자 -> /login 리다이렉트
  if (!user && !isAuthPage && !isApiRoute && !isStatic && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 로그인 상태에서 다시 로그인페이지 진입 시 -> /home 대시보드로 복귀 리다이렉트
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/home', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
