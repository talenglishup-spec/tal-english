import { NextResponse } from 'next/server';
import { getItems } from '@/utils/sheets';

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        // player_id가 필요하다면 추후 getAssignedItemIds 등과 연동 (현재는 전체 풀에서 가져옴)
        const playerId = url.searchParams.get('player_id');

        const allItems = await getItems();

        // 카테고리별 분류 (소문자로 정규화)
        const grouped = {
            onpitch: allItems.filter(i => i.category === 'onpitch'),
            build: allItems.filter(i => i.category === 'build'),
            interview: allItems.filter(i => i.category === 'interview'),
            weak: allItems.filter(i => i.category === 'weak')
        };

        // Fallback: weak 카테고리가 없다면 practice에서 대체하거나 빈 배열 처리
        if (grouped.weak.length === 0) {
            grouped.weak = allItems.filter(i => i.category === 'practice');
        }

        // 지정된 개수만큼 셔플 & 슬라이스
        const dailySet = {
            onpitch: shuffle(grouped.onpitch).slice(0, 8),
            build: shuffle(grouped.build).slice(0, 3),
            interview: shuffle(grouped.interview).slice(0, 2),
            weak: shuffle(grouped.weak).slice(0, 1)
        };

        return NextResponse.json({
            success: true,
            data: dailySet
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to generate daily routine', details: e.message }, { status: 500 });
    }
}
