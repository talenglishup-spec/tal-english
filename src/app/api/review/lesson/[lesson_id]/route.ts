import { NextResponse } from 'next/server';
import { getLessons, getLessonSituations, getAllSituationItems, getItems, getAttempts, TrainingItem, SituationItemRow } from '@/utils/sheets';

export async function GET(request: Request, { params }: { params: Promise<{ lesson_id: string }> }) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'playerId is required' }, { status: 400 });
        }

        const { lesson_id: lessonId } = await params;

        // 1. Fetch Lesson Meta
        const lessons = await getLessons(playerId);
        const lessonMeta = lessons.find(l => l.lesson_id === lessonId);

        if (!lessonMeta) {
            return NextResponse.json({ success: false, error: 'Lesson not found or unauthorized' }, { status: 404 });
        }

        // 2. Fetch Situations & SituationItems
        const situations = await getLessonSituations(lessonId);
        const allSitItems = await getAllSituationItems();
        const sitIds = new Set(situations.map(s => s.situation_id));

        const sitItems = allSitItems.filter(si => sitIds.has(si.situation_id));
        const itemIds = new Set(sitItems.map(si => si.item_id));

        // 3. Fetch Items
        const allItems = await getItems();
        const itemsMap = new Map<string, TrainingItem>();
        allItems.forEach(i => {
            if (itemIds.has(i.id)) itemsMap.set(i.id, i);
        });

        // 4. Fetch Attempts to get item statuses
        const allAttempts = await getAttempts();
        const playerAttempts = allAttempts.filter(a => a.player_id === playerId && itemIds.has(a.item_id));

        // Map item_id -> latest attempt status & score
        // Since getAttempts() returns reverse chronological or we can just sort
        const latestAttemptMap = new Map<string, { status: string; score: number }>();
        playerAttempts.forEach(a => {
            // First one we see should be the latest since getAttempts returns reversed, but to be sure:
            if (!latestAttemptMap.has(a.item_id)) {
                latestAttemptMap.set(a.item_id, {
                    status: a.status || 'finalized',
                    score: typeof a.ai_score === 'number' ? a.ai_score : 0
                });
            } else {
                // If we need strict chronological check:
                // We're good with reverse array order per getAttempts behavior
            }
        });

        // 5. Build Grouped Response
        const groupedSituations = situations.map(sit => {
            const itemsForSit = sitItems
                .filter(si => si.situation_id === sit.situation_id)
                .sort((a, b) => a.item_order - b.item_order)
                .map(si => {
                    const baseItem = itemsMap.get(si.item_id);
                    const attemptData = latestAttemptMap.get(si.item_id);

                    return {
                        item_id: si.item_id,
                        order: si.item_order,
                        category: baseItem?.category || 'practice',
                        subtype: baseItem?.subtype || '',
                        prompt_kr: baseItem?.prompt_kr || '',
                        target_en: baseItem?.target_en || '',
                        last_status: attemptData?.status || 'unattempted',
                        last_score: attemptData?.score !== undefined ? attemptData.score : null
                    };
                });

            return {
                situation_id: sit.situation_id,
                title: sit.situation_title_ko,
                order: sit.situation_order,
                items: itemsForSit
            };
        });

        // 6. Calculate Weak Items
        // Definition: last_status=failed OR score < 60 OR unattempted
        const weakItems = groupedSituations.flatMap(sit =>
            sit.items.filter(item =>
                item.last_status === 'failed' ||
                item.last_status === 'unattempted' ||
                (item.last_score !== null && item.last_score < 60)
            )
        );

        return NextResponse.json({
            success: true,
            data: {
                lesson_meta: lessonMeta,
                situations: groupedSituations,
                weak_items: weakItems
            }
        });

    } catch (error: any) {
        console.error('Error fetching review lesson detail:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
