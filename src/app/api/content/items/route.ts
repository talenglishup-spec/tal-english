/**
 * GET /api/content/items
 *
 * Query params:
 *   position  — FW | MF | DF | GK | ALL      (default: ALL)
 *   type      — interview | training | match | off_pitch
 *   subtype   — post_match | press_conference | tactical | first_day | signing | locker_room
 *   speak     — "1" : speak_mode=true 클립만
 *   limit     — 최대 반환 수 (default: 50, max: 200)
 *
 * Response: { items: ClipItem[], total: number, cached_at: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getClipItems,
    filterByPosition,
    filterByType,
    filterBySubtype,
    filterBySpeakMode,
    type PositionTag,
    type ClipType,
    type ClipSubtype,
} from '@/lib/sheets';

/**
 * 이 라우트는 searchParams를 읽으므로 Next 입장에선 동적이다 — 즉 Next의
 * 캐시(revalidatePath가 지우는 그것)에는 애초에 들어가지 않는다.
 *
 * 예전에는 여기에 revalidate=3600과 함께 `Cache-Control: s-maxage=3600`을
 * 직접 붙였는데, 그 헤더는 Next이 아니라 CDN에게 "1시간 캐시하라"고 지시한다.
 * 결과적으로 응답이 Next 바깥의 CDN에 갇혀, 관리자가 "쇼츠 콘텐츠 새로고침"을
 * 눌러도(=revalidatePath) 지워지지 않고 최대 1시간 옛 시트 내용이 나갔다.
 * (실측: Age 3025초짜리 HIT이 계속 반환)
 *
 * 그래서 CDN·브라우저 캐시를 모두 끈다. 구글 시트 호출 비용은 lib/sheets의
 * 60초 인메모리 캐시가 막아주므로 시트 API를 매 요청 때리지 않는다.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;

        const position  = (searchParams.get('position') || 'ALL')       as PositionTag;
        const type      = searchParams.get('type')                       as ClipType | null;
        const subtype   = searchParams.get('subtype')                    as ClipSubtype | null;
        const speakOnly = searchParams.get('speak') === '1';
        const limit     = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

        let items = await getClipItems();

        if (position !== 'ALL') items = filterByPosition(items, position);
        if (type)               items = filterByType(items, type);
        if (subtype)            items = filterBySubtype(items, subtype);
        if (speakOnly)          items = filterBySpeakMode(items, true);

        const total = items.length;
        items = items.slice(0, limit);

        return NextResponse.json(
            { items, total, cached_at: new Date().toISOString() },
            {
                status: 200,
                headers: {
                    // 시트를 고치고 새로고침을 누르면 바로 반영돼야 한다.
                    // public 캐시가 조금이라도 남으면 그 시간만큼 옛 내용이 나간다.
                    'Cache-Control': 'no-store, must-revalidate',
                },
            }
        );
    } catch (err) {
        console.error('[/api/content/items] Error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch content items', items: [], total: 0 },
            { status: 500 }
        );
    }
}
