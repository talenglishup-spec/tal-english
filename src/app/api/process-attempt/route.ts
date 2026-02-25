import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { openai } from '@/utils/openai';
import { calculateScore } from '@/utils/score';
import { appendAttempt, updateAttempt } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    let attempt_id = '';
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

        const category = formData.get('category') as string || 'onpitch';
        const expected_phrases = formData.get('expected_phrases') as string || '';
        const max_latency_ms = Number(formData.get('max_latency_ms')) || 1500;
        const pattern_selected = formData.get('pattern_selected') as string || '';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        attempt_id = formData.get('attempt_id') as string || uuidv4();
        const fileExt = file.name.split('.').pop();
        const fileName = `${player_id}/${attempt_id}.${fileExt}`;

        // 1. 2-Phase Save (Pending state & Idempotency Check)
        const attemptExists = await updateAttempt(attempt_id, { status: 'pending' });
        if (!attemptExists) {
            await appendAttempt({
                attempt_id,
                date_time: new Date().toISOString(),
                player_id,
                session_id,
                session_mode,
                item_id,
                challenge_type,
                status: 'pending',
                created_at: new Date().toISOString()
            } as any);
        }

        // 2. Upload to Supabase
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

        // 3. V2.0 Evaluation Logic
        let score = 0;
        let feedback = '';
        let matched_text = '';

        // V2.0 Return Data
        let sentence_count = 0;
        let repetition_score = 0;
        let structure_score = 0;

        if (category === 'onpitch') {
            // Priority: Speed and Fuzzy Match
            const isLate = time_to_first_response_ms > max_latency_ms;

            // Expected phrases fallback to target_en
            const validPhrases = expected_phrases
                ? expected_phrases.split(',').map(p => p.trim().toLowerCase())
                : [target_en.toLowerCase()];

            const normalizedStt = stt_text.replace(/[^\w\s]/gi, '').toLowerCase();

            // Check if any expected phrase is in the STT
            const matchedPhrase = validPhrases.find(p => {
                const normalizedP = p.replace(/[^\w\s]/gi, '');
                return normalizedStt.includes(normalizedP);
            });

            if (matchedPhrase) {
                matched_text = matchedPhrase;
                if (!isLate) {
                    score = 100;
                    feedback = 'Perfect reaction! 🔥';
                } else {
                    score = 70;
                    feedback = `Good phrase, but too slow! (Took ${(time_to_first_response_ms / 1000).toFixed(1)}s, max ${max_latency_ms / 1000}s)`;
                }
            } else {
                score = 30;
                feedback = `Incorrect phrase. Expected: ${validPhrases.join(' / ')}`;
            }

        } else if (category === 'interview') {
            // Priority: Structure and Sentence Count
            const sentences = stt_text.split(/[.!?]+/).filter(s => s.trim().length > 3);
            sentence_count = sentences.length;

            if (sentence_count >= 2) {
                score = 80;
                feedback = `Good structure. (${sentence_count} sentences)`;
            } else {
                score = 40;
                feedback = `Try to expand your answer! Minimum 2 sentences needed.`;
            }
            // Basic structure scoring (this will be upgraded with full LLM evaluation later)
            structure_score = Math.min(100, sentence_count * 30 + (duration_sec > 10 ? 10 : 0));
        } else {
            // Fallback (V1 Logic)
            const result = calculateScore(target_en, stt_text, [], key_word);
            score = result.score;
            feedback = result.feedback;
            matched_text = result.matched_text || '';
        }

        // 4. Save to Google Sheets (Finalize 2-Phase)
        const finalizedData = {
            stt_text,
            audio_url,
            duration_sec,
            time_to_first_response_ms,
            ai_score: score,
            coach_feedback: (feedback || '') + (matched_text && matched_text !== target_en && category !== 'onpitch' ? ` (Matched: ${matched_text})` : ""),
            measurement_type,
            question_play_count,
            model_play_count,
            translation_toggle_count,
            answer_revealed,
            latency_ms: time_to_first_response_ms,
            sentence_count,
            repetition_score,
            pattern_selected,
            structure_score,
            status: 'finalized',
            finalized_at: new Date().toISOString()
        };

        await updateAttempt(attempt_id, finalizedData as any);

        return NextResponse.json({
            success: true,
            data: {
                score,
                feedback,
                stt_text,
                audio_url,
                sentence_count,
                structure_score,
                latency_ms: time_to_first_response_ms
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

        if (attempt_id) {
            try {
                await updateAttempt(attempt_id, {
                    status: 'failed',
                    error_message: errorMessage,
                    finalized_at: new Date().toISOString()
                } as any);
            } catch (updateErr) {
                console.error("Failed to update status to failed:", updateErr);
            }
        }

        return NextResponse.json({
            error: errorMessage,
            step: error.step || 'unknown'
        }, { status: 500 });
    }
}
