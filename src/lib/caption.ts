/**
 * 자막 조립 — 긴 문장 안에서 "말할 부분"을 찾아 표시한다.
 *
 * 코치가 길게 설명하는 장면에서는 들리는 문장(script_en)과 말하기 과제
 * (target_phrase)가 다르다. 자막에 짧은 과제만 띄우면 선수가 들은 말을
 * 따라갈 수 없고, 긴 문장만 띄우면 무엇을 말해야 하는지 알 수 없다.
 * 그래서 전체 문장을 보여주되 과제 부분만 강조한다.
 */

/** 비교용 정규화 — 대소문자·문장부호·겹공백 차이는 무시한다 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim();

export type CaptionPart = { text: string; hit: boolean };

/**
 * script 안에서 target과 일치하는 구간을 찾아 쪼갠다.
 * 못 찾으면 통째로 한 조각(hit=false)으로 돌려준다 — 강조만 빠지고 자막은 나온다.
 */
export function splitCaption(script: string, target: string): CaptionPart[] {
  const s = String(script ?? '');
  const t = String(target ?? '');
  if (!s.trim()) return [];
  if (!t.trim()) return [{ text: s, hit: false }];

  // 원문 각 글자가 정규화 문자열의 몇 번째인지 기록해 두고, 정규화 쪽에서
  // 찾은 위치를 원문 위치로 되돌린다(문장부호를 지우고도 원문을 그대로 보여주려고).
  const map: number[] = [];
  let flat = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i].toLowerCase();
    const keep = /[a-z0-9가-힣]/.test(ch) ? ch : ' ';
    if (keep === ' ' && flat.endsWith(' ')) continue;   // 겹공백 접기
    flat += keep;
    map.push(i);
  }
  flat = flat.trimEnd();

  const needle = norm(t);
  const at = flat.indexOf(needle);
  if (at < 0 || !needle) return [{ text: s, hit: false }];

  const from = map[at];
  const lastIdx = Math.min(at + needle.length - 1, map.length - 1);
  const to = map[lastIdx] + 1;

  const parts: CaptionPart[] = [];
  if (from > 0) parts.push({ text: s.slice(0, from), hit: false });
  parts.push({ text: s.slice(from, to), hit: true });
  if (to < s.length) parts.push({ text: s.slice(to), hit: false });
  return parts;
}

/** 자막에 띄울 영어 문장 — script_en이 있으면 그것, 없으면 표현 자체 */
export function captionText(clip: { script_en?: string; target_phrase?: string }): string {
  const script = String(clip.script_en ?? '').trim();
  return script || String(clip.target_phrase ?? '');
}
