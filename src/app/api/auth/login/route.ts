import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    let res = NextResponse.json({ status: 'success' }, { status: 200 });

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              req.cookies.set(name, value)
            );
            res = NextResponse.json({ status: 'success' }, { status: 200 });
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Set cookie headers from SSR client
    const responseBody = { status: 'success', user: data.user };
    const response = new NextResponse(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Copy cookies from 'res' to the final response
    res.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
    });

    return response;

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
