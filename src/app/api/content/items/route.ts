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

export const revalidate = 3600; // ISR 60분

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
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
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
