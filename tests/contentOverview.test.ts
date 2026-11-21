/**
 * lib/contentOverview 회귀 테스트 — `npm test`
 *
 * 어드민 화면의 숫자가 학생이 보는 피드와 같은 기준으로 세어지는지 확인한다.
 * 픽스처는 운영 시트에서 떠온 실제 데이터(tests/fixtures/live_clips.json).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildOverview, type OverviewClip } from '../src/lib/contentOverview.ts';
import { getLevels, expressionsOfLevel, clipsOfLevel } from '../src/lib/levels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const LIVE: OverviewClip[] = JSON.parse(readFileSync(join(here, 'fixtures/live_clips.json'), 'utf8'));

test('레벨·표현·영상 수가 lib/levels 기준과 일치한다', () => {
  const o = buildOverview(LIVE);
  assert.equal(o.totalLevels, getLevels(LIVE).length);
  assert.equal(o.totalClips, LIVE.length, '모든 클립이 어느 레벨엔가 들어간다');
  const expected = getLevels(LIVE).reduce((n, lv) => n + expressionsOfLevel(LIVE, lv).length, 0);
  assert.equal(o.totalExpressions, expected);
});

test('레벨별 영상 수가 그 레벨의 피드 길이와 같다', () => {
  const o = buildOverview(LIVE);
  for (const row of o.levels) {
    assert.equal(row.clipCount, clipsOfLevel(LIVE, row.level).length, `${row.level} 영상 수`);
    assert.equal(
      row.clipCount,
      row.expressions.reduce((n, e) => n + e.clipCount, 0),
      `${row.level} 표현별 합계가 레벨 합계와 같아야 한다`,
    );
  }
});

test('표현의 장면 수를 센다 — 같은 표현의 다른 영상은 한 줄로 묶인다', () => {
  const o = buildOverview(LIVE);
  const first = o.levels[0];
  const manOn = first.expressions.find(e => e.phrase.toLowerCase().startsWith('man on'));
  assert.ok(manOn, '1군 첫 스텝에 Man on! 이 있다');
  assert.equal(manOn.clipCount, 7, '장면 7개가 한 표현으로 묶인다');
  assert.equal(manOn.orders.length, 7);
  assert.deepEqual([...manOn.orders].sort((a, b) => a - b), manOn.orders, '번호는 오름차순');
});

test('화면 라벨은 학생이 보는 것과 같다', () => {
  const o = buildOverview(LIVE);
  assert.equal(o.levels[0].label, '스텝 1-1');
});

test('음성·번역 누락과 장면 1개를 표시한다', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'a1', target_phrase: 'Man on!', level: '1-10', level_order: 10, translation: '뒤에 붙었어!', model_audio_us: 'u', model_audio_uk: 'k' },
    { clip_id: 'a2', target_phrase: 'Man on!', level: '1-10', level_order: 11, translation: '뒤에 붙었어!' },
    { clip_id: 'b1', target_phrase: 'Time!', level: '1-10', level_order: 20 },
  ];
  const o = buildOverview(clips);
  const [manOn, time] = o.levels[0].expressions;

  assert.equal(manOn.clipCount, 2);
  assert.equal(manOn.audioReady, 1);
  assert.equal(manOn.missingAudio, true, '장면 하나라도 음성이 없으면 표시');
  assert.equal(manOn.singleScene, false);

  assert.equal(time.singleScene, true, '장면이 하나뿐');
  assert.equal(time.missingTranslation, true);
  assert.equal(o.missingAudio, 2);
  assert.equal(o.missingTranslation, 1);
  assert.equal(o.singleScene, 1);
});

test('클립이 없으면 빈 현황을 돌려준다', () => {
  const o = buildOverview([]);
  assert.deepEqual(
    [o.totalLevels, o.totalExpressions, o.totalClips, o.maxClipCount],
    [0, 0, 0, 0],
  );
});

// ── findIssues — 어드민 화면이 보여줄 문제 목록 ────────────────
import { findIssues } from '../src/lib/contentOverview.ts';

test('정상 데이터에서는 문제가 없다', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'a', target_phrase: 'Man on!', translation: '붙었다!', category: '수비', level: '1-10', level_order: 10, youtube_url: 'u1', start_sec: 1, end_sec: 5, pause_at: 2 },
    { clip_id: 'b', target_phrase: 'Time!', translation: '시간있어!', category: '공격', level: '1-10', level_order: 20, youtube_url: 'u2', start_sec: 1, end_sec: 5, pause_at: 2 },
    { clip_id: 'c', target_phrase: 'Turn!', translation: '돌아서!', category: '공격', level: '1-10', level_order: 30, youtube_url: 'u3', start_sec: 1, end_sec: 5, pause_at: 2 },
  ];
  assert.deepEqual(findIssues(clips), []);
});

test('clip_id 가 겹치거나 비면 치명으로 잡는다', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'dup', target_phrase: 'A', translation: '가', category: '수비', level: '1-10', level_order: 10 },
    { clip_id: 'dup', target_phrase: 'B', translation: '나', category: '수비', level: '1-10', level_order: 20 },
    { clip_id: '', target_phrase: 'C', translation: '다', category: '수비', level: '1-10', level_order: 30 },
  ];
  const fatal = findIssues(clips).filter(i => i.rank === 'fatal');
  assert.equal(fatal.length, 2, 'id 중복 1건 + id 빈칸 1건');
});

test('10단위가 아닌 level 을 잡는다', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'a', target_phrase: 'A', translation: '가', category: '수비', level: '2-1', level_order: 10 },
    { clip_id: 'b', target_phrase: 'B', translation: '나', category: '수비', level: '2-10', level_order: 10 },
    { clip_id: 'c', target_phrase: 'C', translation: '다', category: '수비', level: 'ENC', level_order: 10 },
  ];
  const fatal = findIssues(clips).filter(i => i.rank === 'fatal');
  assert.equal(fatal.length, 1);
  assert.ok(fatal[0].text.includes('2-1'));
});

test('자막 안에 말할 표현이 없으면 치명', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'a', target_phrase: 'Finish!', script_en: 'Keep the shape and be patient.', translation: '가', category: '공격', level: '1-10', level_order: 10 },
  ];
  assert.ok(findIssues(clips).some(i => i.rank === 'fatal' && i.text.includes('자막')));
});

test('한 장면에서 표현 여럿 — 멈춤이 같으면 주의, 다르면 참고', () => {
  const base = { translation: '가', category: '수비', level: '1-10', youtube_url: 'same', start_sec: 10, end_sec: 14 };
  const same: OverviewClip[] = [
    { ...base, clip_id: 'a', target_phrase: 'Drop!', level_order: 10, pause_at: 11 },
    { ...base, clip_id: 'b', target_phrase: 'Hold!', level_order: 20, pause_at: 11 },
    { ...base, clip_id: 'c', target_phrase: 'Over!', level_order: 30, pause_at: 11 },
  ];
  assert.ok(findIssues(same).some(i => i.rank === 'warn' && i.text.includes('멈춤 지점이 같습니다')));

  const split = same.map((c, i) => ({ ...c, pause_at: 11 + i }));
  const issues = findIssues(split);
  assert.ok(issues.some(i => i.rank === 'info'));
  assert.ok(!issues.some(i => i.text.includes('멈춤 지점이 같습니다')));
});

test('얇은 스텝과 번호 중복을 주의로 잡는다', () => {
  const clips: OverviewClip[] = [
    { clip_id: 'a', target_phrase: 'A', translation: '가', category: '수비', level: '1-10', level_order: 10, youtube_url: 'u1' },
    { clip_id: 'b', target_phrase: 'A', translation: '가', category: '수비', level: '1-10', level_order: 10, youtube_url: 'u2' },
  ];
  const warns = findIssues(clips).filter(i => i.rank === 'warn');
  assert.ok(warns.some(i => i.text.includes('얇습니다')));
  assert.ok(warns.some(i => i.text.includes('같은 번호')));
});
