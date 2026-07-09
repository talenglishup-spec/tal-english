import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/utils/supabase';
import { requireStaffAuth } from '@/utils/supabaseServer';
import { getClipItems, updateClipModelAudio, clearSheetCache } from '@/lib/sheets';
import { ELEVEN_CONFIG } from '@/utils/config';

/**
 * AI 모범답안 TTS 생성 (Phase 2)
 *
 * 쇼츠 Speak 클립의 target_phrase를 ElevenLabs로 미국식/영국식 2종 mp3로
 * 사전 생성해 Supabase Storage(tal-audio/tts/model/{us|uk}/{hash}.mp3)에
 * 올리고, Clips 시트의 model_audio_us / model_audio_uk에 공개 URL을 기록한다.
 *
 * - 같은 문장은 해시로 dedup — 이미 Storage에 있으면 재생성 없이 URL만 연결
 * - body: { clipIds?: string[], force?: boolean }
 *   clipIds 생략 시 speak_mode 클립 전체 대상. force=true면 URL이 있어도 재기록.
 */

type Accent = 'us' | 'uk';
const ACCENTS: Accent[] = ['us', 'uk'];

async function elevenLabsTTS(text: string, accent: Accent): Promise<Buffer> {
    const voiceId = ELEVEN_CONFIG.voices[accent];
    const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVEN_CONFIG.apiKey(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: ELEVEN_CONFIG.modelId,
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        }
    );
    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`ElevenLabs ${accent} 실패 (${res.status}): ${errBody.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: NextRequest) {
    const auth = await requireStaffAuth();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!ELEVEN_CONFIG.apiKey()) {
        return NextResponse.json(
            { error: 'ELEVENLABS_API_KEY가 설정되지 않았습니다 (.env.local / Vercel env).' },
            { status: 500 }
        );
    }

    const supabase = getSupabaseAdmin();

    try {
        const body = await req.json().catch(() => ({}));
        const { clipIds, force = false } = body as { clipIds?: string[]; force?: boolean };

        let clips = (await getClipItems()).filter(c => c.speak_mode && c.target_phrase);
        if (clipIds && Array.isArray(clipIds) && clipIds.length > 0) {
            clips = clips.filter(c => clipIds.includes(c.clip_id));
        }
        // 한 요청당 최대 20클립 (Vercel 타임아웃 및 API 요금 보호)
        clips = clips.slice(0, 20);

        const results: any[] = [];

        for (const clip of clips) {
            const existing: Record<Accent, string> = {
                us: clip.model_audio_us,
                uk: clip.model_audio_uk,
            };
            if (!force && existing.us && existing.uk) {
                results.push({ clip_id: clip.clip_id, status: 'skipped', reason: 'already_has_both' });
                continue;
            }

            const text = clip.target_phrase.trim();
            const hash = createHash('md5').update(text).digest('hex');
            const urls: Partial<Record<'model_audio_us' | 'model_audio_uk', string>> = {};

            try {
                for (const accent of ACCENTS) {
                    if (!force && existing[accent]) continue; // 이미 있는 억양은 유지

                    const fileName = `tts/model/${accent}/${hash}.mp3`;

                    // 같은 문장 mp3가 이미 있으면 재사용 (클립 간 dedup)
                    let publicUrl = '';
                    const { data: found } = await supabase.storage
                        .from('tal-audio')
                        .list(`tts/model/${accent}`, { search: `${hash}.mp3` });
                    const hit = found?.some(f => f.name === `${hash}.mp3`);

                    if (!hit || force) {
                        const buffer = await elevenLabsTTS(text, accent);
                        const { error: upErr } = await supabase.storage
                            .from('tal-audio')
                            .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
                        if (upErr) throw upErr;
                    }

                    const { data: pub } = supabase.storage.from('tal-audio').getPublicUrl(fileName);
                    publicUrl = `${pub.publicUrl}?v=${Date.now()}`;
                    urls[accent === 'us' ? 'model_audio_us' : 'model_audio_uk'] = publicUrl;
                }

                if (Object.keys(urls).length > 0) {
                    const ok = await updateClipModelAudio(clip.clip_id, urls);
                    if (!ok) throw new Error('시트 기록 실패');
                }

                results.push({ clip_id: clip.clip_id, status: 'generated', ...urls });

                // Google Sheets 쿼터 보호
                if (clips.length > 1) await new Promise(r => setTimeout(r, 1100));
            } catch (err: any) {
                console.error(`[model-audio] ${clip.clip_id} 실패:`, err);
                results.push({ clip_id: clip.clip_id, status: 'error', error: err.message });
            }
        }

        clearSheetCache();
        return NextResponse.json({ success: true, count: results.length, results });
    } catch (e: any) {
        console.error('[model-audio] General error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
