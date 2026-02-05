import { NextRequest, NextResponse } from 'next/server';
import { getAttempts, getItems } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const playerId = searchParams.get('playerId');

        let attempts = await getAttempts();
        const items = await getItems();
        const activeItemIds = new Set(items.map(i => i.id));

        // Filter by player if provided
        if (playerId) {
            attempts = attempts.filter(a => a.player_id === playerId);
        }

        const dates = attempts.map(a => {
            const d = new Date(a.date_time);
            return d.toISOString().split('T')[0]; // YYYY-MM-DD
        });

        // Unique active dates
        const uniqueDates = Array.from(new Set(dates)).sort();

        // Calculate Streak
        let currentStreak = 0;
        let dateCursor = new Date();
        const todayStr = dateCursor.toISOString().split('T')[0];

        // Allow missing today if we did it yesterday
        if (!uniqueDates.includes(todayStr)) {
            dateCursor.setDate(dateCursor.getDate() - 1);
        }

        while (true) {
            const dStr = dateCursor.toISOString().split('T')[0];
            if (uniqueDates.includes(dStr)) {
                currentStreak++;
                dateCursor.setDate(dateCursor.getDate() - 1);
            } else {
                break;
            }
        }

        // --- Additional Stats for Dashboard ---

        // 1. Progress % (Unique Items Attempted / Total Active Items)
        const attemptedItemIds = new Set(attempts.map(a => a.item_id).filter(id => id && id !== 'unknown' && activeItemIds.has(id)));
        const uniqueAttemptsCount = attemptedItemIds.size;
        const totalActiveItems = activeItemIds.size;
        const progressPercent = totalActiveItems > 0 ? Math.round((uniqueAttemptsCount / totalActiveItems) * 100) : 0;

        // 2. Avg AI Score (Last 10)
        const gradedAttempts = attempts.filter(a => typeof a.ai_score === 'number' && !isNaN(a.ai_score));
        const last10 = gradedAttempts.slice(0, 10);
        const avgScore = last10.length > 0
            ? Math.round(last10.reduce((sum, a) => sum + a.ai_score, 0) / last10.length)
            : 0;

        // 3. Needs Attention (Ungraded or specific feedback)
        // Just count ungraded attempts (no coach_score)
        const ungradedCount = attempts.filter(a => !a.coach_score).length;

        // 4. Latest Attempt
        const latestAttempt = attempts.length > 0 ? attempts[0] : null;

        return NextResponse.json({
            streak: currentStreak,
            activeDates: uniqueDates,
            totalAttempts: attempts.length,
            uniqueAttemptsCount,
            totalActiveItems,
            progressPercent,
            avgScore,
            ungradedCount,
            latestAttempt
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
