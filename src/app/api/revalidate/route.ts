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

        // 1. 시트 인메모리 캐시 비우기 — 실제로 새 내용을 끌어오는 건 이 한 줄이다.
        //    ⚠️ 서버리스에서 이 캐시는 인스턴스마다 따로 있다. 이 요청을 받은
        //    인스턴스만 즉시 비워지고, 다른 인스턴스는 자기 TTL(60초)이 끝나야
        //    새로 읽는다. 즉 전원에게 반영되기까지 최대 1분이 걸릴 수 있다.
        clearSheetCache();

        // 2. 페이지 캐시 무효화 (/api/content/items는 동적 라우트라 대상 아님 —
        //    캐시를 아예 두지 않으므로 지울 것도 없다)
        revalidatePath('/home');
        revalidatePath('/shorts');

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
            message: 'Cache cleared. Other serverless instances refresh within their 60s TTL.',
            path_revalidated: ['/home', '/shorts']
        });
    } catch (err: any) {
        return NextResponse.json({ error: 'Error revalidating', message: err.message }, { status: 500 });
    }
}

export const GET = handle;
export const POST = handle;
