import { NextResponse } from 'next/server';
import { getClips } from '@/utils/sheets';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const clipId = searchParams.get('clip_id');

        if (!clipId) {
            return NextResponse.json({ error: 'clip_id is required' }, { status: 400 });
        }

        const clips = await getClips();
        const clip = clips.find(c => c.clip_id === clipId);

        if (!clip) {
            return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            clip
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
