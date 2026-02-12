import { NextResponse } from 'next/server';
import { getLessons } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
        }

        const lessons = await getLessons(playerId);
        return NextResponse.json({ lessons });
    } catch (error: any) {
        console.error('Get Lessons Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch lessons' }, { status: 500 });
    }
}
