import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabaseServer';
import { getClipItems } from '@/lib/sheets';
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

const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * 판정 완화 규칙 (중고등 왕기초 대상 — "넘어가는 기분"이 학습 지속의 핵심)
 *
 *  ① 철자 유사 허용: STT가 drop→drops, organized→organised 처럼 살짝 다르게
 *     받아쓰는 경우가 잦다. 단어 길이에 비례해 편집거리를 허용한다.
 *  ② 기능어 제외: a/the/to 같은 관사·전치사는 발음이 뭉개져도 의미 전달에
 *     지장이 없으므로 합격 판정에서 뺀다(화면에는 그대로 표시).
 *  ③ 전 단어 → 비율: 내용어의 PASS_RATIO 이상 맞으면 합격.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or',
  'it', 'is', 'am', 'are', 'be', 'do', 'does', 'did', 'that', 'this',
]);
const PASS_RATIO = 0.6;

/** 길이에 비례한 편집거리 허용 — 짧은 단어는 정확히, 길수록 관대하게 */
function fuzzyEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  // 4글자 이하는 오차를 허용하지 않는다 — hold↔cold 처럼 뜻이 완전히 다른
  // 단어가 통과해버린다. 한 단어짜리 표현은 이 검사가 유일한 관문이라 특히 중요.
  if (len <= 4) return false;
  return levenshtein(a, b) <= (len >= 7 ? 2 : 1);
}

/**
 * target 문장의 각 단어가 사용자가 말한 문장(spoken)에 (순서를 지키며)
 * 포함됐는지 LCS(최장 공통 부분수열)로 정렬해 표시한다.
 * SPEAK식 단어별 초록/회색 피드백을 위한 데이터.
 * 반환: target 단어 순서대로 [{ w: 원본단어, ok: boolean }]
 */
function wordDiff(target: string, spoken: string): { w: string; ok: boolean }[] {
  const targetWords = target.split(/\s+/).filter(Boolean);
  const t = targetWords.map(normWord);
  const s = spoken.split(/\s+/).map(normWord).filter(Boolean);

  const n = t.length;
  const m = s.length;
  // LCS DP — 완전 일치가 아니라 fuzzyEq(철자 유사 허용)로 맞춘다
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = fuzzyEq(t[i], s[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // backtrack: LCS에 포함된 target 인덱스 = 정답(초록)
  const ok = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (fuzzyEq(t[i], s[j])) {
      ok[i] = true; i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return targetWords.map((w, idx) => ({ w, ok: ok[idx] }));
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const audio = data.get('audio') as Blob;
    const clip_id = data.get('clip_id') as string;

    if (!audio || !clip_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 지연 단축: STT(가장 긴 작업)를 먼저 시작해 두고, 시트 조회와 세션
    // 확인(각각 네트워크 왕복)을 그 시간에 병렬로 흡수한다. 이전에는 넷이
    // 직렬이라 시트 캐시 미스 시 채점 응답이 수 초까지 늘어졌다.
    const sttPromise = (async () => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const buffer = Buffer.from(await audio.arrayBuffer());
      const file = await OpenAI.toFile(buffer, 'speech.webm', { type: 'audio/webm' });
      // whisper-1보다 빠르고 저렴한 최신 STT 모델
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'gpt-4o-mini-transcribe',
        language: 'en'
      });
      return transcription.text || '';
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

    let transcript = '';
    try {
      transcript = await sttPromise;
    } catch (sttErr: any) {
      // STT 호출 실패를 자동 합격으로 처리하면 오디오를 일부러 깨뜨려
      // 채점을 우회할 수 있으므로, 실패는 실패로 응답한다(채점 실패를
      // 그대로 fail 처리하지 않고 클라이언트가 재시도하도록 에러를 반환).
      console.error('[speak-score] STT failed:', sttErr);
      return NextResponse.json({ error: 'stt_failed' }, { status: 502 });
    }

    console.log(`[STT] Result: "${transcript}" | Target: "${target_phrase}"`);

    const score = getSimilarityScore(transcript, target_phrase); // 로그/분석용으로만 유지
    const words = wordDiff(target_phrase, transcript);
    // 판정: 점수 숫자가 아니라 "표현을 맞게 말했는가" — 내용어(기능어 제외)의
    // PASS_RATIO 이상이 (순서 유지하며) 인식되면 합격. 앞뒤 군더더기 말은 허용.
    // (왕기초 타깃 MVP 정책 — 쇼츠·챌린지·재도전 공통 단일 기준)
    const contentWords = words.filter(w => !STOPWORDS.has(normWord(w.w)));
    const gate = contentWords.length > 0 ? contentWords : words; // 전부 기능어면 전체로 판정
    const matchedRatio = gate.length > 0 ? gate.filter(w => w.ok).length / gate.length : 0;
    const passed = transcript.trim().length > 0 && matchedRatio >= PASS_RATIO;

    // RLS Rerouting using @supabase/ssr Server Client (STT와 병렬로 이미 조회됨)
    const { supabase, user } = await authPromise;

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

    return NextResponse.json({ passed, score, transcript, words }, { status: 200 });

  } catch (err: any) {
    console.error('[speak-score API Error]:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
