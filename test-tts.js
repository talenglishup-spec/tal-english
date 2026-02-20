require('dotenv').config({ path: '.env.local' });
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

async function test() {
    try {
        const openai = new OpenAI();
        const r = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: 'Test message',
        });
        console.log('OpenAI TTS success');
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const buffer = Buffer.from(await r.arrayBuffer());
        console.log('Buffer size:', buffer.length);
        const result = await sb.storage.from('tal-audio').upload('tts/test_file.mp3', buffer, { upsert: true, contentType: 'audio/mpeg' });
        if (result.error) console.log('Supabase Error:', result.error);
        else console.log('Upload OK!', result.data);
    } catch (e) { console.error('Error:', e.message); }
}
test();
