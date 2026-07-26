import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clearSheetCache, getClipItems } from '@/lib/sheets';
import { requireStaffAuth } from '@/utils/supabaseServer';

/**
 * 콘텐츠(Clips 시트) 캐시 무효화.
 *
 * 인증 2경로:
 *   (1) 로그인한 관리자 세션 → 어드민 페이지의 "콘텐츠 새로고침" 버튼용.
 *       (URL에 토큰을 노출하지 않는다)
 *   (2) ?secret=ADMIN_TOKEN → 브라우저 북마크·n8n 등 서버-서버 호출 폴백.
 */
async function handle(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const secret = searchParams.get('secret');
        const validToken = process.env.ADMIN_TOKEN || 'tal2026';

        if (secret !== validToken) {
            const auth = await requireStaffAuth();
            if (!auth.ok) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
            }
        }

        // 1. Clear Next.js Route Cache for content items
        revalidatePath('/api/content/items');
        
        // 2. Clear Next.js Page Cache for related routes
        revalidatePath('/home');
        revalidatePath('/shorts');
        
        // 3. Clear In-memory Sheets Cache
        clearSheetCache();

        // 4. 즉시 재조회해 결과를 돌려준다 — 관리자가 "몇 개가 반영됐는지"를
        //    버튼 한 번으로 확인할 수 있게(캐시도 미리 데워진다).
        let clipCount: number | null = null;
        let speakCount: number | null = null;
        try {
            const items = await getClipItems();
            clipCount = items.length;
            speakCount = items.filter(i => i.speak_mode && i.pause_at > 0 && i.target_phrase).length;
        } catch (e) {
            // 재조회 실패해도 캐시 무효화 자체는 성공 — 개수만 생략한다.
        }

        return NextResponse.json({
            revalidated: true,
            now: Date.now(),
            clipCount,
            speakCount,
            message: 'Cache successfully cleared. The application will fetch fresh data from Google Sheets on the next request.',
            path_revalidated: ['/api/content/items', '/home', '/shorts']
        });
    } catch (err: any) {
        return NextResponse.json({ error: 'Error revalidating', message: err.message }, { status: 500 });
    }
}

export const GET = handle;
export const POST = handle;
