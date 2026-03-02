import { NextResponse } from 'next/server';
import { getSheet, ReviewVideoRow } from '@/utils/sheets';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        // Query param filters
        const result_context = url.searchParams.get('result_context');
        const speaker_role = url.searchParams.get('speaker_role');
        const level = url.searchParams.get('level');
        const tag = url.searchParams.get('tag');

        const sheet = await getSheet('ReviewVideos');
        if (!sheet) return NextResponse.json({ data: [] });

        const rows = await sheet.getRows();
        let videos: ReviewVideoRow[] = rows.map(r => ({
            active: r.get('active') === 'TRUE' || r.get('active') === 'true' || r.get('active') === true,
            video_id: r.get('video_id') || '',
            title_ko: r.get('title_ko') || '',
            title_en: r.get('title_en') || '',
            result_context: r.get('result_context') || '',
            team_context: r.get('team_context') || '',
            speaker_role: r.get('speaker_role') || '',
            level: r.get('level') || '',
            primary_tags: r.get('primary_tags') || '',
            youtube_url: r.get('youtube_url') || '',
            source_notes: r.get('source_notes') || '',
            linked_question_ids: r.get('linked_question_ids') || ''
        })).filter(v => v.active);

        // Apply filters
        if (result_context) {
            videos = videos.filter(v => v.result_context.toLowerCase() === result_context.toLowerCase() || v.result_context.toLowerCase() === 'any');
        }
        if (speaker_role) {
            videos = videos.filter(v => v.speaker_role.toLowerCase() === speaker_role.toLowerCase());
        }
        if (level) {
            videos = videos.filter(v => v.level === level);
        }
        if (tag) {
            videos = videos.filter(v => v.primary_tags.toLowerCase().includes(tag.toLowerCase()));
        }

        return NextResponse.json({ success: true, data: videos });
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch review videos', details: e.message }, { status: 500 });
    }
}
