export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getExpressionProgress, saveExpressionProgress } from '@/utils/sheets';
import { getSupabaseAdmin } from '@/utils/supabase';
import { v4 as uuidv4 } from 'uuid';

// GET /api/expressions/progress?playerId=xxx&lessonId=xxx
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const lessonId = searchParams.get('lessonId') || undefined;

    if (!playerId) {
        return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    try {
        const progress = await getExpressionProgress(playerId, lessonId);
        return NextResponse.json({ progress });
    } catch (err: any) {
        console.error('[GET /api/expressions/progress]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/expressions/progress  (multipart/form-data)
// Fields:
//   player_id, expression_id, lesson_id, mode, completed,
//   cloze_answer, cloze_score, speaking_completed
//   audio (File, optional — only for speaking mode)
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const player_id          = formData.get('player_id')          as string;
        const expression_id      = formData.get('expression_id')      as string;
        const lesson_id          = formData.get('lesson_id')          as string;
        const mode               = formData.get('mode')               as 'view' | 'cloze' | 'speaking' | 'flashcard';
        const completed          = formData.get('completed')          === 'true';
        const cloze_answer       = (formData.get('cloze_answer')      as string) || '';
        const cloze_score        = Number(formData.get('cloze_score') || 0);
        const speaking_completed = formData.get('speaking_completed') === 'true';
        const audioFile          = formData.get('audio')              as File | null;

        if (!player_id || !expression_id || !lesson_id || !mode) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Upload speaking audio to Supabase if provided
        let speaking_audio_url = '';
        if (audioFile && mode === 'speaking') {
            const supabaseAdmin = getSupabaseAdmin();
            const ext      = audioFile.name.split('.').pop() || 'webm';
            const fileName = `expressions/${player_id}/${expression_id}_${uuidv4()}.${ext}`;
            const buffer   = await audioFile.arrayBuffer();

            const { error: uploadErr } = await supabaseAdmin.storage
                .from('tal-audio')
                .upload(fileName, buffer, {
                    contentType: audioFile.type || 'audio/webm',
                    upsert: true,
                });

            if (!uploadErr) {
                const { data } = supabaseAdmin.storage.from('tal-audio').getPublicUrl(fileName);
                speaking_audio_url = data.publicUrl;
            } else {
                console.error('Speaking audio upload failed:', uploadErr);
            }
        }

        await saveExpressionProgress({
            id:                 uuidv4(),
            player_id,
            expression_id,
            lesson_id,
            mode,
            completed,
            cloze_answer,
            cloze_score,
            speaking_audio_url,
            speaking_completed,
            completed_at: completed ? new Date().toISOString() : '',
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[POST /api/expressions/progress]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
