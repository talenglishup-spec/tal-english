import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_KEY;

  // 1. 환경변수가 미등록된 경우 런타임 에러로 튕기는 현상 완벽 방어
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Middleware Warn] Supabase environment variables are missing. Bypassing authentication guard.');
    return res;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
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
              request: req,
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

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
    const isApiRoute = pathname.startsWith('/api/');
    const isStatic = pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/);
    const isLanding = pathname === '/';
    const isDemo = pathname.startsWith('/shorts-demo') || pathname.startsWith('/learn-modes-demo') || pathname.startsWith('/youtube-test');

    const isPublic = isAuthPage || isApiRoute || isStatic || isLanding || isDemo;

    if (!user && !isPublic) {
      const redirectRes = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.getAll().forEach(c => {
        redirectRes.cookies.set(c.name, c.value, c);
      });
      return redirectRes;
    }

    if (user && isAuthPage) {
      const redirectRes = NextResponse.redirect(new URL('/home', req.url));
      res.cookies.getAll().forEach(c => {
        redirectRes.cookies.set(c.name, c.value, c);
      });
      return redirectRes;
    }

  } catch (err) {
    console.error('[Middleware Error Catch]:', err);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
