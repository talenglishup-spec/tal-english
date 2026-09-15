/**
 * lib/speakJudge 회귀 테스트 — `npm test`
 *
 * 케이스는 체험단 직전 실측에서 나온 실제 받아쓰기를 그대로 쓴다
 * (OpenAI TTS로 한국식 발음을 합성해 두 STT 모델에 넣은 결과).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuzzyEq, judgeTranscript, pickBestTranscript, isNoiseTranscript, STT_PROMPT,
} from '../src/lib/speakJudge.ts';

// ── 짧은 단어: 모음 차이는 허용, 자음 차이는 탈락 ──────────────
test('모음만 다른 짧은 단어는 같은 단어로 본다', () => {
  assert.ok(fuzzyEq('man', 'men'));
  assert.ok(fuzzyEq('time', 'taim'));
  assert.ok(fuzzyEq('me', 'mi'));
});

test('자음이 다른 짧은 단어는 탈락 — 뜻이 다른 단어다', () => {
  assert.equal(fuzzyEq('hold', 'cold'), false);
  assert.equal(fuzzyEq('drop', 'trop'), false);
  assert.equal(fuzzyEq('over', 'oba'), false);
  assert.equal(fuzzyEq('on', 'in'), false);
});

test('긴 단어는 기존대로 길이 비례 편집거리', () => {
  assert.ok(fuzzyEq('organized', 'organised'));
  // 7글자 이상은 2회 편집까지 허용(기존 규칙 그대로) — 전혀 다른 단어만 탈락
  assert.equal(fuzzyEq('defender', 'attacker'), false);
});

// ── 실측 받아쓰기 판정 ─────────────────────────────────────────
test('실측: "Men on" 은 Man on! 통과 (예전엔 탈락)', () => {
  assert.equal(judgeTranscript('Man on!', 'Men on').passed, true);
});

test('실측: 한글 받아쓰기 "맨언" 단독으로는 탈락', () => {
  assert.equal(judgeTranscript('Man on!', '맨언').passed, false);
});

test('틀린 표현은 탈락', () => {
  assert.equal(judgeTranscript('Man on!', 'Time.').passed, false);
  assert.equal(judgeTranscript('Hold!', 'Cold.').passed, false);
  assert.equal(judgeTranscript('Drop!', 'Hello, how are you?').passed, false);
});

test('긴 표현은 문장부호·대소문자 무관 통과', () => {
  assert.equal(judgeTranscript('Close the distance!', 'close the distance').passed, true);
});

// ── 무음·환각: 절대 통과하면 안 된다 ────────────────────────────
test('무음 환각 문장은 발화 없음으로 본다', () => {
  assert.ok(isNoiseTranscript('you'));
  assert.ok(isNoiseTranscript('Thank you.'));
  assert.ok(isNoiseTranscript(STT_PROMPT)); // 주 모델이 무음에서 프롬프트를 되뇜(실측)
  assert.equal(isNoiseTranscript('Man on!'), false);
});

test('실측: 무음 파일의 두 받아쓰기 모두 탈락', () => {
  const r = pickBestTranscript('Man on!', [STT_PROMPT, 'Learn English for free www.engvid.com']);
  assert.equal(r.passed, false);
});

test('정답 단어가 들어간 환각도 무음이면 탈락 — "Behind you!" 에 "you"', () => {
  assert.equal(judgeTranscript('Behind you!', 'you').passed, false);
});

// ── 두 모델 중 더 잘 맞는 쪽 ────────────────────────────────────
test('실측: 주 모델이 한글("오버미")이어도 whisper("over me")로 통과', () => {
  const r = pickBestTranscript('Over me!', ['오버미', 'over me']);
  assert.equal(r.passed, true);
  assert.equal(r.transcript, 'over me');
});

test('둘 다 맞으면 주 모델 결과를 유지', () => {
  const r = pickBestTranscript('Man on!', ['Man on!', 'Man on.']);
  assert.equal(r.transcript, 'Man on!');
});

test('후보가 없으면 탈락', () => {
  assert.equal(pickBestTranscript('Man on!', []).passed, false);
});
