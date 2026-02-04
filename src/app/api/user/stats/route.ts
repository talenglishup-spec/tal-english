import { NextResponse } from 'next/server';
import { getAttempts } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const attempts = await getAttempts();

        // MVP: Filter for "demo_player" if needed, or just use all for single user app
        // const myAttempts = attempts.filter(a => a.player_id === 'demo_player');
        // Let's use all for now as it's a personal trainer app

        const dates = attempts.map(a => {
            const d = new Date(a.date_time);
            return d.toISOString().split('T')[0]; // YYYY-MM-DD
        });

        // Unique active dates
        const uniqueDates = Array.from(new Set(dates)).sort();

        // Calculate Streak
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if active today or yesterday to maintain streak
        if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
            let currentCheck = new Date();
            // Start checking from today backwards
            while (true) {
                const checkStr = currentCheck.toISOString().split('T')[0];
                if (uniqueDates.includes(checkStr)) {
                    streak++;
                    currentCheck.setDate(currentCheck.getDate() - 1);
                } else {
                    // Include edge case: if I haven't practiced today but did yesterday, streak is still alive but increment stops?
                    // Simplified logic: Count consecutive days present in uniqueDates backwards from today/yesterday.

                    // Better logic:
                    // 1. Convert uniqueDates to Timestamps
                    // 2. Iterate backwards
                    break;
                }
            }
        } else {
            streak = 0;
        }

        // Simplified Streak Calculation for MVP reliability:
        // Just count how many consecutive days immediately preceding today (inclusive) have entries.
        // Actually for a demo app, let's just count unique active days in the last 7 days? 
        // No, let's try to be real.

        // Re-calc specific streak
        let currentStreak = 0;
        let dateCursor = new Date();
        const oneDay = 24 * 60 * 60 * 1000;

        // Allow missing today if we did it yesterday
        const todayStr = dateCursor.toISOString().split('T')[0];
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

        return NextResponse.json({
            streak: currentStreak,
            activeDates: uniqueDates,
            totalAttempts: attempts.length
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
