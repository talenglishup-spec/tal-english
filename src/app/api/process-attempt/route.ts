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

        const measurement_type = formData.get('measurement_type') as string || 'baseline';
        const key_word = formData.get('key_word') as string || '';

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
            player_name,
            item_id,
            situation,
            target_en,
            stt_text,
            ai_score: score,
            audio_url,
            coach_feedback: feedback + (matched_text && matched_text !== target_en ? ` (Matched: ${matched_text})` : ""),
            measurement_type: measurement_type as any
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
