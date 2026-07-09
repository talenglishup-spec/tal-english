/**
 * 일회성 실행 스크립트: AI 모범답안 TTS 일괄 생성 (ElevenLabs US/UK)
 *
 * /api/admin/generate-model-audio 라우트와 동일한 로직을 관리자 브라우저
 * 세션 없이 CLI에서 직접 실행하기 위한 스크립트. Clips 시트의 speak_mode
 * 클립 전체를 대상으로 target_phrase → 미국식(Adam)/영국식(Daniel) mp3를
 * 생성해 Supabase Storage(tal-audio/tts/model/{us|uk}/{hash}.mp3)에 올리고
 * model_audio_us / model_audio_uk 컬럼에 공개 URL을 기록한다.
 *
 * 실행: node scripts/generate-model-audio.js [--force]
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');
require('dotenv').config({ path: '.env.local' });

const FORCE = process.argv.includes('--force');
const VOICES = {
    us: process.env.ELEVENLABS_VOICE_US || 'pNInz6obpgDQGcFmaJgB', // Adam (US)
    uk: process.env.ELEVENLABS_VOICE_UK || 'onwK4e9ZLuTAKqWW03F9', // Daniel (UK)
};
const MODEL_ID = 'eleven_multilingual_v2';

async function elevenLabsTTS(text, accent) {
    const voiceId = VOICES[accent];
    const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: MODEL_ID,
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        }
    );
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`ElevenLabs ${accent} 실패 (${res.status}): ${body.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

async function main() {
    if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY가 .env.local에 없습니다.');
    }

    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Clips'];
    if (!sheet) throw new Error('"Clips" sheet not found');

    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const rows = await sheet.getRows();
    const targets = rows.filter(r =>
        (r.get('active') || '') === 'TRUE' &&
        (r.get('speak_mode') || '') === 'TRUE' &&
        (r.get('target_phrase') || '').trim() !== ''
    );

    console.log(`대상 클립: ${targets.length}개 (force=${FORCE})`);

    let generated = 0, skipped = 0, failed = 0;

    for (const row of targets) {
        const clipId = row.get('clip_id');
        const text = (row.get('target_phrase') || '').trim();
        const existingUs = row.get('model_audio_us') || '';
        const existingUk = row.get('model_audio_uk') || '';

        if (!FORCE && existingUs && existingUk) {
            console.log(`[${clipId}] 스킵 (이미 US+UK 존재)`);
            skipped++;
            continue;
        }

        const hash = createHash('md5').update(text).digest('hex');
        console.log(`[${clipId}] "${text}"`);

        try {
            const urls = {};
            for (const accent of ['us', 'uk']) {
                const already = accent === 'us' ? existingUs : existingUk;
                if (!FORCE && already) { urls[accent] = already; continue; }

                const fileName = `tts/model/${accent}/${hash}.mp3`;
                const { data: found } = await supabase.storage
                    .from('tal-audio')
                    .list(`tts/model/${accent}`, { search: `${hash}.mp3` });
                const hit = found?.some(f => f.name === `${hash}.mp3`);

                if (!hit || FORCE) {
                    console.log(`  → ${accent} 생성 중...`);
                    const buffer = await elevenLabsTTS(text, accent);
                    const { error: upErr } = await supabase.storage
                        .from('tal-audio')
                        .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
                    if (upErr) throw upErr;
                } else {
                    console.log(`  → ${accent} 재사용 (동일 문장 존재)`);
                }

                const { data: pub } = supabase.storage.from('tal-audio').getPublicUrl(fileName);
                urls[accent] = `${pub.publicUrl}?v=${Date.now()}`;
            }

            row.set('model_audio_us', urls.us);
            row.set('model_audio_uk', urls.uk);
            await row.save();
            console.log(`  ✅ 저장 완료`);
            generated++;

            await new Promise(r => setTimeout(r, 1100)); // Sheets 쿼터 보호
        } catch (err) {
            console.error(`  ❌ 실패: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n완료 — 생성 ${generated} · 스킵 ${skipped} · 실패 ${failed}`);
}

main().catch(err => {
    console.error('스크립트 실패:', err.message);
    process.exit(1);
});
