import { NextResponse } from 'next/server';
import { getSheet, ReviewVideoRow, InterviewQuestionRow } from '@/utils/sheets';

export async function GET(req: Request, { params }: { params: { video_id: string } }) {
    try {
        const videoId = params.video_id;

        const videoSheet = await getSheet('ReviewVideos');
        const qSheet = await getSheet('InterviewQuestions');

        if (!videoSheet || !qSheet) throw new Error('Sheets not found');

        // 1. Get Video
        const vRows = await videoSheet.getRows();
        const vRow = vRows.find(r => r.get('video_id') === videoId);

        if (!vRow || (vRow.get('active') !== 'TRUE' && vRow.get('active') !== 'true' && vRow.get('active') !== true)) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        const video: ReviewVideoRow = {
            active: true,
            video_id: vRow.get('video_id'),
            title_ko: vRow.get('title_ko'),
            title_en: vRow.get('title_en'),
            result_context: vRow.get('result_context'),
            team_context: vRow.get('team_context'),
            speaker_role: vRow.get('speaker_role'),
            level: vRow.get('level'),
            primary_tags: vRow.get('primary_tags') || '',
            youtube_url: vRow.get('youtube_url'),
            source_notes: vRow.get('source_notes'),
            linked_question_ids: vRow.get('linked_question_ids') || ''
        };

        // 2. Recommend Questions
        const qRows = await qSheet.getRows();
        const allQuestions: InterviewQuestionRow[] = qRows
            .filter(r => r.get('active') === 'TRUE' || r.get('active') === 'true' || r.get('active') === true)
            .map(r => ({
                active: true,
                question_id: r.get('question_id'),
                question_en: r.get('question_en'),
                question_ko: r.get('question_ko'),
                pattern_type: r.get('pattern_type'),
                primary_tags: r.get('primary_tags') || '',
                difficulty: r.get('difficulty'),
                followup_group_id: r.get('followup_group_id')
            }));

        let recommended: InterviewQuestionRow[] = [];

        // 2.1 By linked_question_ids
        if (video.linked_question_ids) {
            const linkedIds = video.linked_question_ids.split(',').map(id => id.trim());
            recommended = allQuestions.filter(q => linkedIds.includes(q.question_id));
        }

        // 2.2 Fallback: Primary Tags intersection
        if (recommended.length < 2 && video.primary_tags) {
            const videoTags = video.primary_tags.split(',').map(t => t.trim().toLowerCase());
            const tagMatched = allQuestions.filter(q => {
                if (recommended.find(r => r.question_id === q.question_id)) return false; // skip already added
                const qTags = q.primary_tags.split(',').map(t => t.trim().toLowerCase());
                return qTags.some(qt => videoTags.includes(qt));
            });
            recommended = [...recommended, ...tagMatched.slice(0, 3 - recommended.length)];
        }

        return NextResponse.json({
            success: true,
            data: {
                video,
                recommended_questions: recommended
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
