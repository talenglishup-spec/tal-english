import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSupabase, getSupabaseAdmin } from '@/utils/supabase';
import { getOpenAI } from '@/utils/openai';
import { calculateScore } from '@/utils/score';
import { appendAttempt, updateAttempt } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    let attempt_id = '';
    let session_mode: 'challenge' | 'practice' | 'daily' = 'practice';
    const supabase = getSupabase();
    const supabaseAdmin = getSupabaseAdmin();
    const openai = getOpenAI();
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const situation = formData.get('situation') as string || '';
        const target_en = formData.get('target_en') as string || '';
        const item_id = formData.get('item_id') as string || 'unknown';
        const player_id = formData.get('player_id') as string || 'anon';
        const player_name = formData.get('player_name') as string || 'Anonymous';
        const session_id = formData.get('session_id') as string || uuidv4();
        session_mode = (formData.get('session_mode') as 'challenge' | 'practice' | 'daily') || 'practice';
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

        attempt_id = formData.get('attempt_id') as string || '';
        const isNewAttempt = !attempt_id;
        if (isNewAttempt) {
            attempt_id = uuidv4();
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${player_id}/${attempt_id}.${fileExt}`;

        // 1. Parallelize Initial DB Save, Supabase Upload, and OpenAI Whisper Transcription
        let stt_text = "";
        let audio_url = "";
        let uploadError: any = null;
        let transcriptionError: any = null;
        let dbError: any = null;

        await Promise.all([
            // Task A: Initial DB pending state (Only if not Daily)
            (async () => {
                if (session_mode !== 'daily') {
                    try {
                        let attemptExists = false;
                        if (!isNewAttempt) {
                            attemptExists = await updateAttempt(attempt_id, { status: 'pending' });
                        }
                        
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
                    } catch (e: any) {
                        console.error('Initial DB task failed:', e);
                        dbError = e;
                    }
                }
            })(),

            // Task B: Upload to Supabase and get Public URL - USE supabaseAdmin to avoid RLS issues
            (async () => {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const { error: sError } = await supabaseAdmin.storage.from('tal-audio').upload(fileName, arrayBuffer, {
                        contentType: file.type || 'audio/webm',
                        upsert: true
                    });
                    if (sError) {
                        uploadError = sError;
                    } else {
                        const { data: pUrlData } = supabaseAdmin.storage.from('tal-audio').getPublicUrl(fileName);
                        audio_url = pUrlData.publicUrl;
                    }
                } catch (e: any) {
                    uploadError = e;
                }
            })(),

            // Task C: Transcribe with OpenAI Whisper
            (async () => {
                try {
                    const transcription = await openai.audio.transcriptions.create({
                        file: file,
                        model: 'whisper-1',
                        language: 'en',
                    });
                    stt_text = transcription.text;
                } catch (e: any) {
                    console.error('Whisper Transcription Error:', e);
                    transcriptionError = e;
                }
            })()
        ]);

        if (dbError) {
            console.error('Initial DB Error:', dbError);
            return NextResponse.json({
                error: `Initial DB Entry Failed: ${dbError.message || 'Unknown database error'}`,
                step: 'db_initial'
            }, { status: 500 });
        }

        if (uploadError) {
            console.error('Supabase Upload Error:', uploadError);
            return NextResponse.json({
                error: `Supabase Upload Failed: ${uploadError.message || uploadError.error_description || 'Unknown error'}`,
                step: 'supabase_upload'
            }, { status: 500 });
        }

        if (transcriptionError) {
            console.error('OpenAI Transcription failed:', transcriptionError.message);
            // Non-blocking: continue with empty STT text so the session isn't completely blocked.
            // The real fix is to update the OPENAI_API_KEY in Vercel environment variables.
            stt_text = '';
        }

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

            const safeSttText = stt_text || '';
            const normalizedStt = safeSttText.replace(/[^\w\s]/gi, '').toLowerCase();

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
            const safeSttText = stt_text || '';
            const sentences = safeSttText.split(/[.!?]+/).filter(s => s.trim().length > 3);
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

        if (session_mode !== 'daily') {
            await updateAttempt(attempt_id, finalizedData as any);
        }

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

        if (attempt_id && session_mode !== 'daily') {
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
