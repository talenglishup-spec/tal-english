import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';
import { getClipItems } from '@/lib/sheets';
import { OpenAI } from 'openai';
import { levenshtein, pickBestTranscript, STT_PROMPT, WHISPER_PROMPT } from '@/lib/speakJudge';

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

// 판정 로직(normWord·fuzzyEq·wordDiff·기능어·합격 비율)은 lib/speakJudge.ts로 옮겼다 — 테스트하려고.

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const audio = data.get('audio') as Blob;
    const clip_id = data.get('clip_id') as string;
    // 진행 소스: 'shorts'(레벨 반영, 기본) | 'challenge' | 'collection_retry'
    // (뒤 둘은 연습 — 레벨 미반영). 레벨(passedClips)은 source='shorts'만
    // 집계하므로 연습 통과는 레벨을 올리지 않고 참여도 데이터로만 남는다.
    // collection_retry를 따로 두는 이유: "이미 합격한 표현의 자발적 복습"은
    // 챌린지 드릴과 학습 동기가 달라 분석에서 섞이면 안 된다.
    const modeRaw = (data.get('mode') as string) || 'shorts';
    const source =
      modeRaw === 'challenge' ? 'challenge'
      : modeRaw === 'collection_retry' ? 'collection_retry'
      : 'shorts';

    if (!audio || !clip_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 지연 단축: STT(가장 긴 작업)를 먼저 시작해 두고, 시트 조회와 세션
    // 확인(각각 네트워크 왕복)을 그 시간에 병렬로 흡수한다. 이전에는 넷이
    // 직렬이라 시트 캐시 미스 시 채점 응답이 수 초까지 늘어졌다.
    const sttPromise = (async () => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const buffer = Buffer.from(await audio.arrayBuffer());
      // 업로드된 파일의 실제 포맷을 그대로 넘긴다. 예전에는 webm으로 고정해
      // 두어, iOS가 보낸 mp4 데이터에 webm 딱지가 붙어 STT가 해독하지
      // 못했다(아이폰에서 말하기가 전혀 통과되지 않던 원인).
      const uploadedName = typeof (audio as any).name === 'string' ? (audio as any).name : '';
      const uploadedType = audio.type || '';
      const EXT_BY_TYPE: Record<string, string> = {
        'audio/webm': 'webm', 'audio/ogg': 'ogg',
        'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/aac': 'aac',
        'audio/mpeg': 'mp3', 'audio/wav': 'wav',
      };
      const baseType = uploadedType.split(';')[0].trim();
      const ext =
        (uploadedName.match(/\.([A-Za-z0-9]{2,4})$/)?.[1] || '').toLowerCase()
        || EXT_BY_TYPE[baseType]
        || 'webm';
      const mkFile = () => OpenAI.toFile(buffer, `speech.${ext}`, { type: baseType || 'audio/webm' });
      // 두 모델을 병렬로 돌려 목표와 더 잘 맞는 쪽을 쓴다(pickBestTranscript).
      //  - gpt-4o-mini-transcribe: 발음이 괜찮으면 가장 정확. 다만 한국식 발음은
      //    language:'en'이어도 한글로 받아적는다(실측: "Man on" → "맨언").
      //  - whisper-1 + language:'en': 한글로 절대 안 쓴다. 대신 짧은 단어를
      //    가끔 잘못 듣는다 — 그래서 둘 중 나은 쪽.
      // 프롬프트에 정답 문구를 넣지 않는다 — 넣으면 무음에서 정답을 지어내
      // 통과해버린다(실측: 무음 파일 → "Man on!").
      // 클라이언트가 12초에 끊으므로 각 호출은 재시도 없이 8초로 제한한다.
      const opts = { timeout: 8000, maxRetries: 0 };
      const settled = await Promise.allSettled([
        openai.audio.transcriptions.create(
          { file: await mkFile(), model: 'gpt-4o-mini-transcribe', language: 'en', prompt: STT_PROMPT }, opts),
        openai.audio.transcriptions.create(
          { file: await mkFile(), model: 'whisper-1', language: 'en', prompt: WHISPER_PROMPT }, opts),
      ]);
      const texts = settled
        .filter((r): r is PromiseFulfilledResult<{ text: string }> => r.status === 'fulfilled')
        .map(r => r.value.text || '');
      if (texts.length === 0) throw (settled[0] as PromiseRejectedResult).reason;
      return texts;
    })();
    const clipsPromise = getClipItems();
    const authPromise = (async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return { supabase, user };
    })();

    // 정답 문구는 클라이언트가 보낸 값을 신뢰하지 않고 clip_id로 서버에서
    // 직접 조회한다. 클라이언트가 target_phrase를 임의로 조작해 채점을
    // 우회하는 것을 막기 위함.
    const clips = await clipsPromise;
    const clip = clips.find(c => c.clip_id === clip_id);
    if (!clip || !clip.target_phrase) {
      return NextResponse.json({ error: 'Unknown clip_id' }, { status: 400 });
    }
    const target_phrase = clip.target_phrase;

    let candidates: string[] = [];
    try {
      candidates = await sttPromise;
    } catch (sttErr: any) {
      // STT 호출 실패를 자동 합격으로 처리하면 오디오를 일부러 깨뜨려
      // 채점을 우회할 수 있으므로, 실패는 실패로 응답한다(채점 실패를
      // 그대로 fail 처리하지 않고 클라이언트가 재시도하도록 에러를 반환).
      console.error('[speak-score] STT failed:', sttErr);
      return NextResponse.json({ error: 'stt_failed' }, { status: 502 });
    }

    // 판정: 점수 숫자가 아니라 "표현을 맞게 말했는가" — 내용어의 PASS_RATIO
    // 이상이 순서대로 인식되면 합격(쇼츠·챌린지·재도전 공통 단일 기준).
    const best = pickBestTranscript(target_phrase, candidates);
    const { words, passed } = best;
    // 기록엔 채택된 받아쓰기를 남긴다. 무음으로 판정돼 비었으면 빈 값 그대로 —
    // 원문으로 되돌리면 프롬프트 되뇌기("The audio is a short…")가 분석용
    // stt_text에 섞인다(실측).
    const transcript = best.transcript;
    console.log(`[STT] ${candidates.map(c => `"${c}"`).join(' | ')} → ${passed ? 'PASS' : 'FAIL'} | Target: "${target_phrase}"`);

    const score = getSimilarityScore(transcript, target_phrase); // 로그/분석용으로만 유지

    // RLS Rerouting using @supabase/ssr Server Client (STT와 병렬로 이미 조회됨)
    const { supabase, user } = await authPromise;

    if (user) {
      const baseRow = {
        player_id: user.id,
        clip_id,
        stt_text: transcript,
        levenshtein_score: score,
        passed,
      };
      let { error: dbError } = await supabase
        .from('speak_attempts_log')
        .insert({ ...baseRow, source }); // 'shorts'=레벨 반영 / 'challenge'=연습

      // 마이그레이션(source 컬럼) 미적용 환경 폴백 — 컬럼 없이 기록해 기록
      // 유실을 막는다. 컬럼이 생기면 자동으로 위 경로가 성공한다.
      if (dbError && /source/i.test(dbError.message || '')) {
        ({ error: dbError } = await supabase.from('speak_attempts_log').insert(baseRow));
      }
      if (dbError) {
        console.error('[speak-score DB Log Error]:', dbError.message);
      }
    } else {
      console.warn('[speak-score API] Anonymous session, DB write skipped.');
    }

    return NextResponse.json({ passed, score, transcript, words }, { status: 200 });

  } catch (err: any) {
    console.error('[speak-score API Error]:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
