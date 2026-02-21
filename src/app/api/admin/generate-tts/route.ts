import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { openai } from '@/utils/openai';
import { getItems, updateItem } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';
import { TTS_CONFIG } from '@/utils/config';

export async function POST(req: NextRequest) {
    try {
        const { itemIds, force, type = 'answer' } = await req.json();

        if (!itemIds || !Array.isArray(itemIds)) {
            return NextResponse.json({ error: 'itemIds array is required' }, { status: 400 });
        }

        const allItems = await getItems();
        const results = [];

        for (const itemId of itemIds) {
            const item = allItems.find(i => i.id === itemId);
            if (!item) {
                results.push({ itemId, status: 'not_found' });
                continue;
            }

            try {
                let textToSpeak = '';
                let fileName = '';
                let isQuestion = type === 'question';

                if (isQuestion) {
                    // Skip conditions for Question TTS
                    if (!item.question_text || item.question_text.trim() === '') {
                        results.push({ itemId, status: 'skipped', reason: 'no_question_text' });
                        continue;
                    }
                    if (item.question_audio_source === 'manual') {
                        results.push({ itemId, status: 'skipped', reason: 'manual_source' });
                        continue;
                    }
                    if (item.question_audio_en && !force) {
                        results.push({ itemId, status: 'skipped', url: item.question_audio_en });
                        continue;
                    }

                    textToSpeak = item.question_text.trim();
                    fileName = `tts/q/${itemId}.mp3`;
                } else {
                    // Skip conditions for Answer TTS
                    if (!item.target_en) {
                        results.push({ itemId, status: 'no_target_text' });
                        continue;
                    }
                    if (item.model_audio_url && !force) {
                        results.push({ itemId, status: 'skipped', url: item.model_audio_url });
                        continue;
                    }

                    textToSpeak = item.target_en;
                    fileName = `tts/en/${itemId}.mp3`;
                }

                // 1. Generate TTS
                console.log(`Generating TTS for ${itemId}: ${textToSpeak} (Voice: ${TTS_CONFIG.voice}, Type: ${type})`);
                const mp3Response = await openai.audio.speech.create({
                    model: TTS_CONFIG.model,
                    voice: TTS_CONFIG.voice,
                    input: textToSpeak,
                });

                const buffer = Buffer.from(await mp3Response.arrayBuffer());

                // 2. Upload to Supabase
                const { error: uploadError } = await supabaseAdmin.storage
                    .from('tal-audio')
                    .upload(fileName, buffer, {
                        contentType: 'audio/mpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseAdmin.storage
                    .from('tal-audio')
                    .getPublicUrl(fileName);

                // Add cache-bust parameter ?v=timestamp to bypass caching in browsers
                const audioUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

                // 3. Update Sheet
                if (isQuestion) {
                    await updateItem(itemId, {
                        question_audio_en: audioUrl,
                        question_audio_source: 'tts'
                    });
                } else {
                    await updateItem(itemId, {
                        model_audio_url: audioUrl,
                        audio_source: 'tts'
                    });
                }

                results.push({ itemId, status: 'generated', url: audioUrl });

            } catch (err: any) {
                console.error(`Error processing item ${itemId}:`, err);
                results.push({ itemId, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('TTS Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
