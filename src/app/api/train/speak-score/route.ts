import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';
import { OpenAI } from 'openai';

function levenshtein(a: string, b: string): number {
  const tmp: number[][] = [];
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (let i = 0; i <= alen; i++) tmp[i] = [i];
  for (let j = 0; j <= blen; j++) tmp[0][j] = j;
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

function getSimilarityScore(s1: string, s2: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const c1 = clean(s1);
  const c2 = clean(s2);
  if (!c1 && !c2) return 100;
  if (!c1 || !c2) return 0;
  const dist = levenshtein(c1, c2);
  const maxLen = Math.max(c1.length, c2.length);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const audio = data.get('audio') as Blob;
    const target_phrase = data.get('target_phrase') as string;
    const clip_id = data.get('clip_id') as string;

    if (!audio || !target_phrase || !clip_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const buffer = Buffer.from(await audio.arrayBuffer());
    const file = await OpenAI.toFile(buffer, 'speech.webm', { type: 'audio/webm' });
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en'
    });

    const transcript = transcription.text || '';
    console.log(`[Whisper STT] Result: "${transcript}" | Target: "${target_phrase}"`);

    const score = getSimilarityScore(transcript, target_phrase);
    const passed = score >= 80;

    // RLS Rerouting using @supabase/ssr Server Client
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error: dbError } = await supabase
        .from('speak_attempts_log')
        .insert({
          player_id: user.id,
          clip_id,
          stt_text: transcript,
          levenshtein_score: score,
          passed
        });

      if (dbError) {
        console.error('[speak-score DB Log Error]:', dbError.message);
      }
    } else {
      console.warn('[speak-score API] Anonymous session, DB write skipped.');
    }

    return NextResponse.json({ passed }, { status: 200 });

  } catch (err: any) {
    console.error('[speak-score API Error]:', err);
    return NextResponse.json({ passed: true }, { status: 200 });
  }
}
