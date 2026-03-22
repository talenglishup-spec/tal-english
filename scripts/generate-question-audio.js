const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Config
const VOICE = 'alloy';
const MODEL = 'tts-1';

async function generateBulk() {
    console.log("Starting Bulk Question Audio Generation with Deduplication...");

    // 1. Setup Auth
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

    const auth = new JWT({
        email: SERVICE_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Items'];
    if (!sheet) {
        console.error("Sheet 'Items' not found");
        return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for upload
    );

    const rows = await sheet.getRows();
    console.log(`Searching through ${rows.length} rows...`);

    let count = 0;
    for (const row of rows) {
        const itemId = row.get('item_id');
        const questionText = row.get('question_text');
        const questionAudioUrl = row.get('question_audio');

        if (questionText && questionText.trim() !== '' && !questionAudioUrl) {
            const textToSpeak = questionText.trim();
            const textHash = createHash('md5').update(textToSpeak).digest('hex');
            const fileName = `tts/q/shared_${textHash}.mp3`;

            console.log(`[${itemId}] Processing: ${textToSpeak}`);
            
            try {
                let audioUrl = '';

                // Check if shared audio already exists in Supabase
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
                        console.log(`[${itemId}] Found existing shared audio.`);
                    }
                }

                if (!audioUrl) {
                    console.log(`[${itemId}] Generating new audio...`);
                    // Generate TTS
                    const mp3Response = await openai.audio.speech.create({
                        model: MODEL,
                        voice: VOICE,
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

                const finalUrl = `${audioUrl}?v=${Date.now()}`;

                // Update Sheet
                row.set('question_audio', finalUrl);
                row.set('question_audio_source', 'tts');
                await row.save();
                
                console.log(`[${itemId}] Saved: ${finalUrl}`);
                count++;

                // Wait to respect Google Sheets quota
                await new Promise(r => setTimeout(r, 1100));

            } catch (err) {
                console.error(`[${itemId}] Failed:`, err.message);
            }
        }
    }

    console.log(`Finished! Total generated/linked: ${count}`);
}

generateBulk();
