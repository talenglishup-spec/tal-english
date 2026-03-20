import { NextResponse } from 'next/server';
import { getItems, getPlayerItemsWithContext, getLessons, getAllLessonSituations, getAllSituationItems } from '@/utils/sheets';

// Prevent caching to ensure fresh data from Sheets
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function formatPlayerId(id: string): string {
    if (!id) return '';
    const upperId = id.toUpperCase();
    if (upperId.startsWith('STU_')) {
        return 'P' + upperId.substring(4);
    }
    return id; // Return as is for ADMIN_001 or other patterns
}
 
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

            // item_id -> list of { playerId, lessonNo, label }
            const itemContextMap: Record<string, { pId: string; lNo: number; label: string }[]> = {};
            sitItems.forEach(si => {
                const lessonId = sitMap.get(si.situation_id);
                if (lessonId) {
                    const lesson = lessonMap.get(lessonId);
                    if (lesson) {
                        const pId = formatPlayerId(lesson.player_id);
                        const lNo = lesson.lesson_no;
                        const label = `${pId}-L${lNo}`;
                        
                        if (!itemContextMap[si.item_id]) {
                            itemContextMap[si.item_id] = [];
                        }
                        
                        // Avoid duplicates if same item in same lesson (unlikely but safe)
                        if (!itemContextMap[si.item_id].some(m => m.label === label)) {
                            itemContextMap[si.item_id].push({ pId, lNo, label });
                        }
                    }
                }
            });
 
            // Enrich items with playerInfo
            items = items.map(item => {
                const mappings = itemContextMap[item.id] || [];
                // Sort by Player ID ASC, then Lesson No ASC
                const sortedLabels = mappings
                    .sort((a, b) => {
                        if (a.pId !== b.pId) return a.pId.localeCompare(b.pId);
                        return a.lNo - b.lNo;
                    })
                    .map(m => m.label);
 
                return {
                    ...item,
                    playerInfo: sortedLabels.length > 0 ? sortedLabels.join(' / ') : '-'
                };
            });
        }

        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('Get Items Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
    }
}
