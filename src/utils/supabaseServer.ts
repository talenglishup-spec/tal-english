import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 교사/관리자 전용 API를 위한 서버측 권한 검사.
 * 로그인 세션의 이메일을 ADMIN_EMAIL 또는 TEACHER_EMAILS(콤마 구분)
 * 허용 목록과 대조한다. 두 환경변수가 모두 비어 있으면(허용 목록 미설정)
 * 오탐으로 전체 공개되는 것을 막기 위해 항상 거부한다.
 */
export async function requireStaffAuth(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false, status: 401, error: 'Unauthorized: login required' };
    }

    const allowList = [
        process.env.ADMIN_EMAIL,
        ...(process.env.TEACHER_EMAILS || '').split(',').map(e => e.trim()),
    ].filter(Boolean);

    if (allowList.length === 0) {
        console.error('[requireStaffAuth] No ADMIN_EMAIL/TEACHER_EMAILS configured — refusing all requests.');
        return { ok: false, status: 500, error: 'Server misconfigured: no staff allow-list set' };
    }

    if (!user.email || !allowList.includes(user.email)) {
        console.warn('[requireStaffAuth] Non-staff email attempted staff API access:', user.email);
        return { ok: false, status: 403, error: 'Forbidden: staff privilege required' };
    }

    return { ok: true };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context set ignore
          }
        },
      },
    }
  );
}
