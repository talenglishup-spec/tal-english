/**
 * 말하기 채점 — 받아쓴 문장(STT)이 목표 표현과 맞는가.
 *
 * /api/train/speak-score(쇼츠·챌린지·재도전 공통)가 쓴다. 라우트 안에 있던
 * 로직을 테스트하려고 분리했다.
 *
 * 체험단 직전 실측으로 바뀐 것:
 *  ① 한국식 발음은 gpt-4o-mini-transcribe가 language:'en'이어도 한글로
 *     받아적는다("Man on" → "맨언", "Over me" → "오바미"). 한글은 영문 비교에서
 *     전부 지워져 0점이 됐다. → 라우트가 whisper-1(한글을 절대 안 씀)을 함께
 *     돌리고, 여기서 더 잘 맞는 쪽을 고른다(pickBestTranscript).
 *  ② 4글자 이하 단어는 완전 일치만 허용했더니 "men"(←man), "taim"(←time)처럼
 *     한국 학습자가 가장 흔히 내는 모음 차이가 전부 탈락했다. → 모음만 다른
 *     경우는 허용하되, 자음이 다르면(hold↔cold) 여전히 탈락.
 *  ③ STT 프롬프트에 정답 문구를 넣으면 무음 파일에서 정답을 그대로 지어내
 *     통과해버린다(검증: 무음 → "Man on!"). → 프롬프트는 정답 없는 일반 문장만
 *     쓰고, 무음에서 모델이 흔히 지어내는 문장은 발화 없음으로 본다.
 */

export const PASS_RATIO = 0.6;

/** 발음이 뭉개져도 의미 전달에 지장 없는 기능어 — 합격 판정에서 뺀다(화면엔 표시) */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or',
  'it', 'is', 'am', 'are', 'be', 'do', 'does', 'did', 'that', 'this',
]);

/** 주 모델용 STT 프롬프트 — 정답 문구를 절대 넣지 않는다(위 ③) */
export const STT_PROMPT =
  'The audio is a short spoken English phrase from football training, said by a Korean learner. ' +
  'Write it in English words only, never in Korean script.';

export const WHISPER_PROMPT = 'Short English football training phrase.';

export const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

export function levenshtein(a: string, b: string): number {
  const t: number[][] = [];
  for (let i = 0; i <= a.length; i++) t[i] = [i];
  for (let j = 0; j <= b.length; j++) t[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      t[i][j] = Math.min(t[i - 1][j] + 1, t[i][j - 1] + 1, t[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return t[a.length][b.length];
}

/** 첫 글자는 두고 나머지 모음을 뺀 자음 뼈대 — "time"→"tm", "taim"→"tm" */
const skeleton = (w: string) => w[0] + w.slice(1).replace(/[aeiouy]/g, '');

/** 철자 유사 허용 — 짧은 단어는 모음 차이만, 긴 단어는 길이에 비례한 편집거리 */
export function fuzzyEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  if (len <= 4) {
    // 자음이 다르면 뜻이 다른 단어다(hold↔cold, drop↔trop) — 한 단어짜리
    // 표현은 이 검사가 유일한 관문이라 자음은 엄격하게 본다.
    return a[0] === b[0] && Math.abs(a.length - b.length) <= 1 && skeleton(a) === skeleton(b);
  }
  return levenshtein(a, b) <= (len >= 7 ? 2 : 1);
}

export type WordMark = { w: string; ok: boolean };

/**
 * target 각 단어가 spoken에 (순서를 지키며) 들어 있는지 LCS로 정렬한다.
 * 반환: target 단어 순서대로 [{ w: 원본단어, ok }] — 화면의 초록/회색 표시용.
 */
export function wordDiff(target: string, spoken: string): WordMark[] {
  const targetWords = target.split(/\s+/).filter(Boolean);
  const t = targetWords.map(normWord);
  const s = spoken.split(/\s+/).map(normWord).filter(Boolean);
  const n = t.length;
  const m = s.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = fuzzyEq(t[i], s[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (fuzzyEq(t[i], s[j])) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return targetWords.map((w, idx) => ({ w, ok: ok[idx] }));
}

/** 무음·잡음에서 STT가 흔히 지어내는 문장 — whisper에서 흔히 나오는 환각 */
const SILENCE_HALLUCINATIONS = new Set([
  'you', 'thank you', 'thanks for watching', 'thank you for watching', 'bye',
]);

/** 발화가 없었다고 봐야 하는 받아쓰기인가 */
export function isNoiseTranscript(text: string): boolean {
  const flat = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!flat) return false; // 한글만 있는 경우 등 — 노이즈가 아니라 "못 맞춤"으로 둔다
  if (SILENCE_HALLUCINATIONS.has(flat)) return true;
  // 무음에서 주 모델이 프롬프트 문장을 그대로 되뇌는 경우(실측)
  return flat.includes('korean learner') || flat.includes('english words only') || flat.includes('korean script');
}

export type Judgement = { transcript: string; words: WordMark[]; ratio: number; passed: boolean };

export function judgeTranscript(target: string, transcript: string): Judgement {
  const clean = isNoiseTranscript(transcript) ? '' : transcript;
  const words = wordDiff(target, clean);
  const content = words.filter(w => !STOPWORDS.has(normWord(w.w)));
  const gate = content.length > 0 ? content : words; // 전부 기능어면 전체로 판정
  const ratio = gate.length > 0 ? gate.filter(w => w.ok).length / gate.length : 0;
  return { transcript: clean, words, ratio, passed: clean.trim().length > 0 && ratio >= PASS_RATIO };
}

/**
 * 같은 녹음을 여러 STT가 받아쓴 후보 중 목표와 가장 잘 맞는 판정을 고른다.
 * 동점이면 앞(주 모델) 후보를 유지한다.
 */
export function pickBestTranscript(target: string, candidates: string[]): Judgement {
  if (candidates.length === 0) return judgeTranscript(target, '');
  return candidates
    .map(c => judgeTranscript(target, c))
    .reduce((best, cur) => (cur.ratio > best.ratio ? cur : best));
}
