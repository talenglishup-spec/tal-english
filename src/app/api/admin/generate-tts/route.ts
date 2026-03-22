import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSupabaseAdmin } from '@/utils/supabase';
import { getOpenAI } from '@/utils/openai';
import { updateItem, getItems } from '@/utils/sheets';
import { createHash } from 'crypto';
import { TTS_CONFIG } from '@/utils/config';

export async function POST(req: NextRequest) {
    // Initialize clients inside handler to avoid build-time errors (missing env vars during static analysis)
    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();

    try {
        const body = await req.json();
        const { itemIds, type, force = false } = body as { itemIds: string[]; type: 'question' | 'answer'; force?: boolean };
        console.log(`[TTS API] POST request incoming: type=${type}, items=${itemIds?.length}`);

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return NextResponse.json({ success: false, error: 'itemIds is required' }, { status: 400 });
        }

        // Limit batch size
        const batchItemIds = itemIds.slice(0, 30);
        const allItems = await getItems();
        const items = allItems.filter(i => batchItemIds.includes(i.id));

        const results: any[] = [];

        for (const itemId of batchItemIds) {
            const item = items.find(i => i.id === itemId);
            if (!item) {
                results.push({ itemId, status: 'error', error: 'Item not found' });
                continue;
            }

            try {
                let textToSpeak = '';
                let isQuestion = type === 'question';

                if (isQuestion) {
                    // Skip conditions for Question TTS
                    if (!item.question_text) {
                        results.push({ itemId, status: 'skipped', reason: 'no_text' });
                        continue;
                    }
                    if (item.question_audio_source === 'manual' || item.question_audio_source === 'external') {
                        results.push({ itemId, status: 'skipped', reason: `${item.question_audio_source}_source` });
                        continue;
                    }
                    if (item.question_audio_url && !force) {
                        results.push({ itemId, status: 'skipped', url: item.question_audio_url });
                        continue;
                    }

                    textToSpeak = item.question_text.trim();
                } else {
                    // Skip conditions for Answer TTS
                    if (!item.target_en) {
                        results.push({ itemId, status: 'skipped', reason: 'no_text' });
                        continue;
                    }
                    if (item.audio_source === 'manual' || item.audio_source === 'external') {
                        results.push({ itemId, status: 'skipped', reason: `${item.audio_source}_source` });
                        continue;
                    }
                    if (item.model_audio_url && !force) {
                        results.push({ itemId, status: 'skipped', url: item.model_audio_url });
                        continue;
                    }

                    textToSpeak = item.target_en.trim();
                }

                const textHash = createHash('md5').update(textToSpeak || '').digest('hex');
                const fileName = isQuestion ? `tts/q/shared_${textHash}.mp3` : `tts/a/${itemId}.mp3`;

                // 2. Check if shared audio already exists (for questions)
                let audioUrl = '';
                if (isQuestion) {
                    const { data: existingFiles } = await supabase.storage
                        .from('tal-audio')
                        .list('tts/q', { search: `shared_${textHash}.mp3` });

                    if (existingFiles && existingFiles.length > 0) {
                        const fileMatches = existingFiles.some(f => f.name === `shared_${textHash}.mp3`);
                        if (fileMatches) {
                            const { data: publicUrlData } = supabase.storage
                                .from('tal-audio')
                                .getPublicUrl(fileName);
                            audioUrl = publicUrlData.publicUrl;
                            console.log(`[${itemId}] Reusing existing shared audio for: ${textToSpeak}`);
                        }
                    }
                }

                if (!audioUrl) {
                    // Generate TTS
                    console.log(`Generating TTS for ${itemId}: ${textToSpeak} (Voice: ${TTS_CONFIG.voice}, Type: ${type})`);
                    const mp3Response = await openai.audio.speech.create({
                        model: TTS_CONFIG.model,
                        voice: TTS_CONFIG.voice,
                        input: textToSpeak,
                    });

                    const buffer = Buffer.from(await mp3Response.arrayBuffer());

                    // Upload
                    const { error: uploadError } = await supabase.storage
                        .from('tal-audio')
                        .upload(fileName, buffer, {
                            contentType: 'audio/mpeg',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabase.storage
                        .from('tal-audio')
                        .getPublicUrl(fileName);

                    audioUrl = publicUrlData.publicUrl;
                }

                // Add cache-bust parameter ?v=timestamp
                audioUrl = `${audioUrl}?v=${Date.now()}`;

                // 3. Update Sheet
                if (isQuestion) {
                    await updateItem(itemId, {
                        question_audio_url: audioUrl,
                        question_audio_source: 'tts'
                    });
                } else {
                    await updateItem(itemId, {
                        model_audio_url: audioUrl,
                        audio_source: 'tts'
                    });
                }

                results.push({ itemId, status: 'generated', url: audioUrl });

                // Delay to respect Google Sheets quota
                if (batchItemIds.length > 1) {
                    await new Promise(r => setTimeout(r, 1100));
                }

            } catch (err: any) {
                console.error(`Error processing ${itemId}:`, err);
                results.push({ itemId, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        console.error('TTS API General Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
