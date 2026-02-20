import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { openai } from '@/utils/openai';
import { calculateScore } from '@/utils/score';
import { appendAttempt } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const situation = formData.get('situation') as string || '';
        const target_en = formData.get('target_en') as string || '';
        const item_id = formData.get('item_id') as string || 'unknown';
        const player_id = formData.get('player_id') as string || 'anon';
        const player_name = formData.get('player_name') as string || 'Anonymous';
        const session_id = formData.get('session_id') as string || uuidv4();
        const session_mode = (formData.get('session_mode') as 'challenge' | 'practice') || 'practice';
        const challenge_type = formData.get('challenge_type') as any || 'FOOTBALL_KO_TO_EN';

        const measurement_type = formData.get('measurement_type') as string || 'baseline';
        const key_word = formData.get('key_word') as string || '';

        const duration_sec = Number(formData.get('duration_sec') || 0);
        const time_to_first_response_ms = Number(formData.get('time_to_first_response_ms') || 0);
        const question_play_count = Number(formData.get('question_play_count') || 0);
        const model_play_count = Number(formData.get('model_play_count') || 0);
        const translation_toggle_count = Number(formData.get('translation_toggle_count') || 0);
        const answer_revealed = formData.get('answer_revealed') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const attempt_id = uuidv4();
        const fileExt = file.name.split('.').pop();
        const fileName = `${player_id}/${attempt_id}.${fileExt}`;

        // 1. Upload to Supabase
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tal-audio')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Supabase Upload Error:', uploadError);
            return NextResponse.json({
                error: `Supabase Upload Failed: ${uploadError.message}`,
                details: uploadError
            }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage
            .from('tal-audio')
            .getPublicUrl(fileName);

        const audio_url = publicUrlData.publicUrl;

        // 2. Transcribe with OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'en',
        });

        const stt_text = transcription.text;

        // 3. Calculate Score with Variations and Keyword
        const { score, feedback, matched_text } = calculateScore(target_en, stt_text, [], key_word);

        // 4. Save to Google Sheets
        const attemptData = {
            attempt_id,
            date_time: new Date().toISOString(),
            player_id,
            session_id,
            session_mode,
            item_id,
            challenge_type,
            stt_text,
            audio_url,
            duration_sec,
            time_to_first_response_ms,
            ai_score: score,
            coach_feedback: feedback + (matched_text && matched_text !== target_en ? ` (Matched: ${matched_text})` : ""),
            measurement_type,
            question_play_count,
            model_play_count,
            translation_toggle_count,
            answer_revealed
        };

        await appendAttempt(attemptData);

        return NextResponse.json({
            success: true,
            data: {
                score,
                feedback,
                stt_text,
                audio_url
            }
        });

    } catch (error: any) {
        console.error('Process Attempt Error:', error);

        let errorMessage = error.message || 'Internal Server Error';
        if (errorMessage.includes('403')) {
            errorMessage = 'Google Sheets Permission Error (Check Service Account)';
        } else if (errorMessage.includes('bucket')) {
            errorMessage = 'Supabase Storage Error (Check Bucket Name/Public Access)';
        }

        return NextResponse.json({
            error: errorMessage,
            step: error.step || 'unknown'
        }, { status: 500 });
    }
}
