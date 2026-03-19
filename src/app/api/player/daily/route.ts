import { NextResponse } from 'next/server';
import { getSheet, getItems } from '@/utils/sheets';

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
        const { searchParams } = new URL(req.url);
        const playerId = searchParams.get('player_id');

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
        }

        // 1. Get all items
        const allItems = await getItems();

        // Ensure active
        const activeItems = allItems.filter(i => i.active);

        // Split by category
        const onpitchPool = activeItems.filter(i => i.category === 'onpitch');
        const interviewPool = activeItems.filter(i => i.category === 'interview');
        const buildPool = activeItems.filter(i => i.category === 'build');
        let weakPool = activeItems.filter(i => i.category === 'weak');

        // Optional: Get last 3 days weak items from Attempts
        try {
            const attemptsSheet = await getSheet('Attempts');
            if (attemptsSheet) {
                const rows = await attemptsSheet.getRows();
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                const recentWeakItemIds = new Set<string>();

                for (let i = rows.length - 1; i >= 0; i--) {
                    const row = rows[i];
                    if (row.get('player_id') !== playerId) continue;

                    const finalizedAt = row.get('finalized_at') || row.get('created_at');
                    if (!finalizedAt) continue;

                    const date = new Date(finalizedAt);
                    if (date < threeDaysAgo) break; // Assuming sorted descending

                    const score = Number(row.get('ai_score'));
                    if (score < 80) { // Consider weak if score < 80
                        recentWeakItemIds.add(row.get('item_id'));
                    }
                }

                const weakFromAttempts = activeItems.filter(item => recentWeakItemIds.has(item.id));
                if (weakFromAttempts.length > 0) {
                    weakPool = [...weakPool, ...weakFromAttempts];
                }
            }
        } catch (e) {
            console.error('Failed to get weak items from attempts', e);
        }

        // Fallback for weak if still empty
        if (weakPool.length === 0) {
            weakPool = [...interviewPool, ...buildPool];
        }

        // Note: Avoiding yesterday's items could be done if we store past dailies,
        // but for now random shuffle naturally spreads out items.

        // Select items
        const selectedOnpitch = shuffle(onpitchPool).slice(0, 4);
        const selectedInterview = shuffle(interviewPool).slice(0, 2);
        const selectedBuild = shuffle(buildPool).slice(0, 2);
        const selectedWeak = shuffle(weakPool).slice(0, 1);

        // Deduplicate weak from others just in case
        const selectedSet = new Set([...selectedOnpitch.map(i => i.id), ...selectedInterview.map(i => i.id), ...selectedBuild.map(i => i.id)]);
        const finalWeak = selectedWeak.filter(i => !selectedSet.has(i.id));

        if (finalWeak.length === 0 && weakPool.length > 0) {
            // grab another one that is not in set
            const fallbackWeak = shuffle(weakPool).find(i => !selectedSet.has(i.id));
            if (fallbackWeak) finalWeak.push(fallbackWeak);
        }

        const dailyItems = [
            ...selectedOnpitch,
            ...selectedInterview,
            ...selectedBuild,
            ...finalWeak
        ];

        const dateStr = new Date().toISOString().split('T')[0];
        const dailyId = `DLY_${playerId}_${dateStr}`;

        return NextResponse.json({
            success: true,
            daily_id: dailyId,
            items: dailyItems
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
