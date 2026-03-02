import { NextResponse } from 'next/server';
import { getLessonSituations, getAllSituationItems, getItems, getAttempts, TrainingItem } from '@/utils/sheets';

export async function POST(request: Request, { params }: { params: Promise<{ lesson_id: string }> }) {
    try {
        const body = await request.json();
        const { playerId, mode } = body; // mode = 'rerun' | 'weak_only' | 'quick5'

        if (!playerId || !mode) {
            return NextResponse.json({ success: false, error: 'playerId and mode are required' }, { status: 400 });
        }

        const { lesson_id: lessonId } = await params;

        // 1. Fetch Items for this lesson
        const situations = await getLessonSituations(lessonId);
        const allSitItems = await getAllSituationItems();
        const sitIds = new Set(situations.map(s => s.situation_id));
        const sitItems = allSitItems.filter(si => sitIds.has(si.situation_id));

        // Sort situation items properly: situation_order, then item_order
        const sitOrderMap = new Map(situations.map(s => [s.situation_id, s.situation_order]));
        sitItems.sort((a, b) => {
            const orderA = sitOrderMap.get(a.situation_id) || 0;
            const orderB = sitOrderMap.get(b.situation_id) || 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.item_order - b.item_order;
        });

        const itemIds = new Set(sitItems.map(si => si.item_id));

        const allItems = await getItems();
        const itemsMap = new Map<string, TrainingItem>();
        allItems.forEach(i => {
            if (itemIds.has(i.id)) itemsMap.set(i.id, i);
        });

        // 2. Fetch Attempts for status
        const allAttempts = await getAttempts();
        const playerAttempts = allAttempts.filter(a => a.player_id === playerId && itemIds.has(a.item_id));

        const latestAttemptMap = new Map<string, { status: string; score: number }>();
        playerAttempts.forEach(a => {
            if (!latestAttemptMap.has(a.item_id)) {
                latestAttemptMap.set(a.item_id, {
                    status: a.status || 'finalized',
                    score: typeof a.ai_score === 'number' ? a.ai_score : 0
                });
            }
        });

        // 3. Build enriched items array in standard order
        const enrichedList = sitItems.map(si => {
            const baseItem = itemsMap.get(si.item_id);
            const attemptData = latestAttemptMap.get(si.item_id);
            return {
                ...baseItem,
                situation_id: si.situation_id,
                item_order: si.item_order,
                last_status: attemptData?.status || 'unattempted',
                last_score: attemptData?.score !== undefined ? attemptData.score : null
            };
        }).filter(item => item.id !== undefined); // remove missing items

        // 4. Apply Mode Logic
        let finalItems: any[] = [];

        if (mode === 'rerun') {
            finalItems = enrichedList;
        } else if (mode === 'weak_only') {
            finalItems = enrichedList.filter(item =>
                item.last_status === 'failed' ||
                item.last_status === 'unattempted' ||
                (item.last_score !== null && item.last_score < 60)
            );
            // prioritize failed, then unseen (unattempted), then low score
            finalItems.sort((a, b) => {
                const getRank = (i: any) => {
                    if (i.last_status === 'failed') return 1;
                    if (i.last_status === 'unattempted') return 2;
                    return 3;
                };
                return getRank(a) - getRank(b);
            });
        } else if (mode === 'quick5') {
            const weakItems = enrichedList.filter(item =>
                item.last_status === 'failed' ||
                item.last_status === 'unattempted' ||
                (item.last_score !== null && item.last_score < 60)
            );

            // Prioritize weak items
            const pool = weakItems.length > 0 ? weakItems : enrichedList;

            // Random Shuffle
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            finalItems = pool.slice(0, 5);
        } else {
            return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
        }

        // Make sure we have items
        if (finalItems.length === 0) {
            return NextResponse.json({ success: false, error: 'No items found for this mode' }, { status: 404 });
        }

        // Instead of URL, we return the items direct since stateful redirect is tricky without sets DB
        return NextResponse.json({
            success: true,
            data: {
                items: finalItems,
                // We'll let the frontend handle the state (e.g. setDrillItems(items)) so redirect_url isn't strictly needed if we manage within the same page
            }
        });

    } catch (error: any) {
        console.error('Error in review lesson launch:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
