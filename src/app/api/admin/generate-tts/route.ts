import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { openai } from '@/utils/openai';
import { getItems, updateItem } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';
import { TTS_CONFIG } from '@/utils/config';

export async function POST(req: NextRequest) {
    try {
        const { itemIds, force } = await req.json();

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

            if (item.model_audio_url && !force) {
                results.push({ itemId, status: 'skipped', url: item.model_audio_url });
                continue;
            }

            if (!item.target_en) {
                results.push({ itemId, status: 'no_target_text' });
                continue;
            }

            try {
                // 1. Generate TTS
                console.log(`Generating TTS for ${itemId}: ${item.target_en} (Voice: ${TTS_CONFIG.voice})`);
                const mp3Response = await openai.audio.speech.create({
                    model: TTS_CONFIG.model,
                    voice: TTS_CONFIG.voice,
                    input: item.target_en,
                });

                const buffer = Buffer.from(await mp3Response.arrayBuffer());

                // 2. Upload to Supabase
                // clean filename
                const fileName = `tts/${itemId}_${Date.now()}.mp3`;

                // Need to remove old one? Maybe later. For now just new file.
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

                const audioUrl = publicUrlData.publicUrl;

                // 3. Update Sheet
                await updateItem(itemId, {
                    model_audio_url: audioUrl,
                    audio_source: 'tts'
                });

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
