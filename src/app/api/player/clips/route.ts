import { NextResponse } from 'next/server';
import { getClips } from '@/utils/sheets';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const playerId = searchParams.get('player_id');
        const contextTag = searchParams.get('context_tag');

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
        }

        const clips = await getClips();

        let filtered = clips;
        if (contextTag && contextTag !== 'all' && contextTag !== 'All') {
            filtered = clips.filter(c => c.context_tag?.toLowerCase() === contextTag.toLowerCase());
        }

        const list = filtered.map(c => ({
            clip_id: c.clip_id,
            title_ko: c.title_ko,
            context_tag: c.context_tag,
            player_name: c.player_name,
            duration: c.start_sec && c.end_sec ? c.end_sec - c.start_sec : null
        })).reverse();

        return NextResponse.json({
            success: true,
            clips: list
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
