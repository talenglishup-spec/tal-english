import { NextResponse } from 'next/server';
import { getItems, getPlayerItemsWithContext, getLessons, getAllLessonSituations, getAllSituationItems } from '@/utils/sheets';

// Prevent caching to ensure fresh data from Sheets
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');
        const lessonId = searchParams.get('lessonId');
        const includeContext = searchParams.get('includeContext') === 'true';

        if (playerId) {
            // New Logic: Return Enriched Items with Lesson Context
            const items = await getPlayerItemsWithContext(playerId);
            return NextResponse.json({ items });
        }

        // Fallback or specific lesson logic
        let items = await getItems();

        if (lessonId) {
            const { getStructuredLessonContent } = await import('@/utils/sheets');
            const structured = await getStructuredLessonContent(lessonId);
            // Flatten structured content to list of items
            items = structured.flatMap(content => content.items);
        }

        // Add context mapping if requested (used by Admin Dashboard)
        if (includeContext) {
            const [lessons, situations, sitItems] = await Promise.all([
                getLessons(),
                getAllLessonSituations(),
                getAllSituationItems()
            ]);

            const lessonMap = new Map();
            lessons.forEach(l => lessonMap.set(l.lesson_id, l));

            const sitMap = new Map();
            situations.forEach(s => sitMap.set(s.situation_id, s.lesson_id));

            // item_id -> string of "P001-L37 / P002-L39"
            const itemContextMap: Record<string, string[]> = {};
            sitItems.forEach(si => {
                const lessonId = sitMap.get(si.situation_id);
                if (lessonId) {
                    const lesson = lessonMap.get(lessonId);
                    if (lesson) {
                        const label = `${lesson.player_id}-L${lesson.lesson_no}`;
                        if (!itemContextMap[si.item_id]) {
                            itemContextMap[si.item_id] = [];
                        }
                        if (!itemContextMap[si.item_id].includes(label)) {
                            itemContextMap[si.item_id].push(label);
                        }
                    }
                }
            });

            // Enrich items with playerInfo
            items = items.map(item => ({
                ...item,
                playerInfo: (itemContextMap[item.id] || []).join(' / ')
            }));
        }

        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('Get Items Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
    }
}
