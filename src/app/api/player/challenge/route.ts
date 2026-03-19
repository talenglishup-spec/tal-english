import { NextResponse } from 'next/server';
import { getItems } from '@/utils/sheets';

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
        const type = searchParams.get('type') || 'onpitch';

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
        }

        const allItems = await getItems();

        // Ensure active
        const activeItems = allItems.filter(i => i.active);

        const pool = activeItems.filter(i => i.category === type);

        // Return 10 random items for challenge
        const challengeItems = shuffle(pool).slice(0, 10);

        return NextResponse.json({
            success: true,
            items: challengeItems
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
