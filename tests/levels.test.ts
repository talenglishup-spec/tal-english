/**
 * lib/levels 회귀 테스트 — `npm test`
 *
 * fixtures/live_clips.json 은 구글시트 Clips 탭의 active=TRUE 행 51개를 그대로
 * 떠온 것이다(clip_id / target_phrase / level / level_order). 레벨 체계를 바꿀
 * 때 실제 콘텐츠에서 무엇이 달라지는지 눈으로 확인할 수 있어야 해서, 합성
 * 데이터가 아니라 운영 데이터를 픽스처로 쓴다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  levelRank, levelLabel, sortClipsByLevel, getLevels, clipsOfLevel,
  expressionsOfLevel, levelProgress, isLevelCleared, getUnlockedLevels,
  getCurrentLevel, stageKeyOf, levelsOfStage, expressionKeyOf,
  passedExpressionKeys, type LevelClip,
} from '../src/lib/levels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const LIVE: LevelClip[] = JSON.parse(readFileSync(join(here, 'fixtures/live_clips.json'), 'utf8'));

// ── 1. 레벨 정렬 순서 ─────────────────────────────────────────
test('levelRank: Main 사다리 → 워밍업 → 격려 → 심판 어필 → 미배정', () => {
  const shuffled = ['REF', 'WARM-2', '2-2', 'ENC', '1-10', '1-2', 'WARM-1', '-', '', '4-1', '1-1'];
  const sorted = [...shuffled].sort((a, b) => levelRank(a) - levelRank(b));
  assert.deepEqual(sorted, ['1-1', '1-2', '1-10', '2-2', '4-1', 'WARM-1', 'WARM-2', 'ENC', 'REF', '-', '']);
});

test('levelRank: 1-10 은 1-2 뒤 (문자열 정렬이 아니라 숫자 정렬)', () => {
  assert.ok(levelRank('1-2') < levelRank('1-10'));
  assert.ok(levelRank('1-10') < levelRank('2-1'));
});

test('levelRank: 레거시 S1 은 1단계 선두로 흡수', () => {
  assert.ok(levelRank('S1') < levelRank('1-1'));
  assert.ok(levelRank('S1') < levelRank('S2'));
  assert.ok(levelRank('S2') < levelRank('2-1'));
});

test('levelRank: 알 수 없는 코드는 미배정과 같이 맨 뒤', () => {
  assert.equal(levelRank('BOGUS'), levelRank(''));
  assert.equal(levelRank('-'), levelRank(undefined));
});

test('라이브 데이터의 getLevels 순서가 요청한 순서와 일치', () => {
  assert.deepEqual(getLevels(LIVE), [
    '1-1', '1-2', '1-3', '1-4', '1-5',
    '2-1', '2-2', '2-3', '2-4',
    '3-1',
    'ENC', 'REF',
  ]);
});

// ── 2. 표시 문구 ──────────────────────────────────────────────
test('levelLabel: 코드별 한글 문구', () => {
  assert.equal(levelLabel('1-1'), '스텝 1-1');
  assert.equal(levelLabel('2-3'), '스텝 2-3');
  assert.equal(levelLabel('S1'), '스텝 1');
  assert.equal(levelLabel('WARM-2'), '워밍업 2');
  assert.equal(levelLabel('ENC'), '격려');
  assert.equal(levelLabel('REF'), '심판 어필');
});

test('levelLabel: 빈 값·미배정·모르는 코드는 원문 그대로', () => {
  assert.equal(levelLabel(''), '');
  assert.equal(levelLabel(undefined), '');
  assert.equal(levelLabel('-'), '-');
  assert.equal(levelLabel('BOGUS'), 'BOGUS');
});

// ── 3. 레벨 내 라운드로빈 (중복 클립 분산) ────────────────────
test('같은 표현이 연속으로 쏟아지지 않는다 — 1-1 최대 연속 3 이하', () => {
  const feed = clipsOfLevel(LIVE, '1-1');
  assert.equal(feed.length, 17, '1-1 활성 클립 17개');

  let maxRun = 1, run = 1;
  for (let i = 1; i < feed.length; i++) {
    run = feed[i].target_phrase === feed[i - 1].target_phrase ? run + 1 : 1;
    if (run > maxRun) maxRun = run;
  }
  // 예전 level_order 단순 정렬은 "Man on!" 7연속이었다.
  assert.ok(maxRun <= 3, `최대 연속 ${maxRun}회 — 4회 이상이면 분산 실패`);
});

test('라운드로빈 첫 바퀴는 level_order 순서를 그대로 지킨다', () => {
  const feed = clipsOfLevel(LIVE, '1-1');
  assert.deepEqual(feed.slice(0, 5).map(c => c.level_order), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    feed.slice(0, 5).map(c => c.target_phrase),
    ['Man on!', 'Time!', 'Drop!', 'Over!', 'Turn!'],
  );
});

test('sortClipsByLevel: 레벨 경계를 넘지 않는다', () => {
  const sorted = sortClipsByLevel(LIVE);
  const ranks = sorted.map(c => levelRank(c.level));
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i] >= ranks[i - 1], `${i}번째에서 레벨 순위가 역행`);
  }
  assert.equal(sorted.length, LIVE.length, '정렬이 클립을 잃거나 늘리지 않는다');
});

// ── 4. 표현 단위 클리어 ───────────────────────────────────────
test('expressionsOfLevel: 중복 클립을 한 칸으로 묶는다', () => {
  const groups = expressionsOfLevel(LIVE, '1-1');
  assert.equal(groups.length, 5, '1-1 은 클립 17개지만 표현은 5개');
  assert.deepEqual(
    groups.map(g => g.clip.target_phrase),
    ['Man on!', 'Time!', 'Drop!', 'Over!', 'Turn!'],
  );
  assert.equal(groups.find(g => g.clip.target_phrase === 'Man on!')!.clips.length, 7);
});

test('표현 묶음은 클립 하나만 통과해도 완료 — 관문이 5칸으로 줄어든다', () => {
  const groups = expressionsOfLevel(LIVE, '1-1');
  // 각 표현의 첫 클립만 통과시킨다 (17개 중 5개)
  const passed = new Set(groups.map(g => g.clips[0].clip_id));
  assert.equal(passed.size, 5);

  assert.deepEqual(levelProgress(LIVE, '1-1', passed), { done: 5, total: 5 });
  assert.ok(isLevelCleared(LIVE, '1-1', passed), '표현 5개 완료 = 레벨 클리어');
});

test('표현 하나라도 남으면 미클리어', () => {
  const groups = expressionsOfLevel(LIVE, '1-1');
  const passed = new Set(groups.slice(0, 4).map(g => g.clips[0].clip_id));
  assert.deepEqual(levelProgress(LIVE, '1-1', passed), { done: 4, total: 5 });
  assert.equal(isLevelCleared(LIVE, '1-1', passed), false);
});

test('표현이 빈 클립끼리는 절대 한 칸으로 합쳐지지 않는다', () => {
  const blanks: LevelClip[] = [
    { clip_id: 'a', target_phrase: '', level: 'X-1', level_order: 1 },
    { clip_id: 'b', target_phrase: '', level: 'X-1', level_order: 2 },
  ];
  assert.equal(expressionsOfLevel(blanks, 'X-1').length, 2);
});

test('대소문자·문장부호만 다른 표현은 같은 칸', () => {
  const dup: LevelClip[] = [
    { clip_id: 'a', target_phrase: 'Man on!', level: 'X-1', level_order: 1 },
    { clip_id: 'b', target_phrase: 'man on',  level: 'X-1', level_order: 1 },
  ];
  const groups = expressionsOfLevel(dup, 'X-1');
  assert.equal(groups.length, 1);
  assert.ok(isLevelCleared(dup, 'X-1', new Set(['b'])), 'b 만 통과해도 클리어');
});

test('빈 레벨은 클리어로 치지 않는다', () => {
  assert.equal(isLevelCleared(LIVE, '없는레벨', new Set()), false);
});

// ── 5. 해금·진행 레벨 ─────────────────────────────────────────
test('신규 유저는 1-1 부터 시작한다', () => {
  const none = new Set<string>();
  assert.equal(getCurrentLevel(LIVE, none), '1-1');
  assert.deepEqual(getUnlockedLevels(LIVE, none), ['1-1']);
});

test('1-1 을 표현 단위로 클리어하면 1-2 가 열린다', () => {
  const passed = new Set(expressionsOfLevel(LIVE, '1-1').map(g => g.clips[0].clip_id));
  assert.deepEqual(getUnlockedLevels(LIVE, passed), ['1-1', '1-2']);
  assert.equal(getCurrentLevel(LIVE, passed), '1-2');
});

test('전부 통과하면 마지막 레벨(REF)에 머문다', () => {
  const all = new Set(LIVE.map(c => c.clip_id));
  assert.equal(getCurrentLevel(LIVE, all), 'REF');
  assert.equal(getUnlockedLevels(LIVE, all).length, getLevels(LIVE).length);
});

test('클립이 없으면 진행 레벨도 없다', () => {
  assert.equal(getCurrentLevel([], new Set()), null);
});

// ── 6. 스텝 군(앞자리 숫자) ───────────────────────────────────
test('stageKeyOf: 앞자리 숫자가 군, 트랙은 트랙 이름이 군', () => {
  assert.equal(stageKeyOf('1-1'), '1');
  assert.equal(stageKeyOf('1-10'), '1');
  assert.equal(stageKeyOf('2-4'), '2');
  assert.equal(stageKeyOf('S3'), '3');
  assert.equal(stageKeyOf('WARM-2'), 'WARM');
  assert.equal(stageKeyOf('ENC'), 'ENC');
  assert.equal(stageKeyOf('-'), null);
  assert.equal(stageKeyOf(''), null);
});

test('levelsOfStage: 한 군의 레벨만 순서대로', () => {
  assert.deepEqual(levelsOfStage(LIVE, '1'), ['1-1', '1-2', '1-3', '1-4', '1-5']);
  assert.deepEqual(levelsOfStage(LIVE, '2'), ['2-1', '2-2', '2-3', '2-4']);
  assert.deepEqual(levelsOfStage(LIVE, '3'), ['3-1']);
});

// ── 7. 띄엄띄엄한 시트 번호를 화면에서 순번으로 ───────────────
test('시트가 1-5, 1-10, 1-15 여도 화면은 스텝 1-1, 1-2, 1-3', () => {
  const gapped: LevelClip[] = [
    { clip_id: 'a', target_phrase: 'A', level: '1-5',  level_order: 1 },
    { clip_id: 'b', target_phrase: 'B', level: '1-10', level_order: 1 },
    { clip_id: 'c', target_phrase: 'C', level: '1-15', level_order: 1 },
  ];
  assert.deepEqual(getLevels(gapped), ['1-5', '1-10', '1-15'], '정렬은 숫자 크기 순');
  assert.equal(levelLabel('1-5', gapped), '스텝 1-1');
  assert.equal(levelLabel('1-10', gapped), '스텝 1-2');
  assert.equal(levelLabel('1-15', gapped), '스텝 1-3');
});

test('사이에 끼워넣어도 뒤 번호를 안 밀고 순번만 다시 매겨진다', () => {
  const inserted: LevelClip[] = [
    { clip_id: 'a', target_phrase: 'A', level: '1-5',  level_order: 1 },
    { clip_id: 'x', target_phrase: 'X', level: '1-7',  level_order: 1 }, // 나중에 끼움
    { clip_id: 'b', target_phrase: 'B', level: '1-10', level_order: 1 },
  ];
  assert.equal(levelLabel('1-7', inserted), '스텝 1-2');
  assert.equal(levelLabel('1-10', inserted), '스텝 1-3');
});

test('clips를 안 넘기면 예전처럼 시트 숫자를 그대로 쓴다', () => {
  assert.equal(levelLabel('1-10'), '스텝 1-10');
});

test('라이브 데이터는 이미 촘촘해서 표시가 그대로', () => {
  assert.equal(levelLabel('1-3', LIVE), '스텝 1-3');
  assert.equal(levelLabel('2-4', LIVE), '스텝 2-4');
});

// ── 8. 통과한 표현 — 말하기 면제 판정 ─────────────────────────
test('passedExpressionKeys: 통과한 표현은 다른 장면에서도 통과로 인식', () => {
  const manOn = clipsOfLevel(LIVE, '1-1').filter(c => c.target_phrase === 'Man on!');
  assert.ok(manOn.length >= 2, '중복 장면이 있어야 의미 있는 테스트');

  const passed = new Set([manOn[0].clip_id]);   // 첫 장면만 통과
  const keys = passedExpressionKeys(LIVE, passed);

  // 나머지 "Man on!" 장면들도 전부 통과한 표현으로 잡힌다 → 말하기 강제 안 함
  for (const c of manOn.slice(1)) {
    assert.ok(keys.has(expressionKeyOf(c)), `${c.clip_id} 이 면제되어야 함`);
  }
  // 아직 안 한 다른 표현은 면제 대상이 아니다
  const time = clipsOfLevel(LIVE, '1-1').find(c => c.target_phrase === 'Time!')!;
  assert.equal(keys.has(expressionKeyOf(time)), false);
});

// ── 9. 피드: 보던 스텝에 머물고, 눌러야 넘어간다 ─────────────
// 컴포넌트의 activeLevel / feedClips / nextUnlockedLevel 계산을 그대로 재현한다.
function activeLevelOf(clips: LevelClip[], passed: Set<string>, viewing: string | null): string | null {
  const unlocked = getUnlockedLevels(clips, passed);
  if (unlocked.length === 0) return null;
  if (viewing && unlocked.includes(viewing)) return viewing;
  return getCurrentLevel(clips, passed);
}
function feedOf(clips: LevelClip[], activeLevel: string | null): LevelClip[] {
  return activeLevel ? clipsOfLevel(clips, activeLevel) : clips;
}
function nextUnlockedOf(clips: LevelClip[], passed: Set<string>, activeLevel: string | null): string | null {
  if (!activeLevel) return null;
  const unlocked = getUnlockedLevels(clips, passed);
  const i = unlocked.indexOf(activeLevel);
  return i >= 0 && i + 1 < unlocked.length ? unlocked[i + 1] : null;
}
function prevUnlockedOf(clips: LevelClip[], passed: Set<string>, activeLevel: string | null): string | null {
  if (!activeLevel) return null;
  const unlocked = getUnlockedLevels(clips, passed);
  const i = unlocked.indexOf(activeLevel);
  return i > 0 ? unlocked[i - 1] : null;
}

/** 1-1의 표현을 각각 한 장면씩 통과시킨 상태 */
const cleared11 = () => new Set(expressionsOfLevel(LIVE, '1-1').map(g => g.clips[0].clip_id));

test('클리어해도 보던 스텝에 그대로 머문다', () => {
  const passed = cleared11();
  assert.ok(isLevelCleared(LIVE, '1-1', passed), '먼저 클리어 상태여야 함');
  // 예전에는 여기서 getCurrentLevel이 1-2를 가리켜 피드가 갈렸다.
  assert.equal(activeLevelOf(LIVE, passed, '1-1'), '1-1');
});

test('피드에는 보던 스텝의 클립만 — 다음 스텝이 섞이지 않는다', () => {
  const passed = cleared11();
  const feed = feedOf(LIVE, activeLevelOf(LIVE, passed, '1-1'));
  assert.equal(feed.length, 17, '1-1의 17개 그대로');
  assert.deepEqual([...new Set(feed.map(c => c.level))], ['1-1']);
});

test('클리어 전에는 다음 스텝 버튼이 없다', () => {
  const none = new Set<string>();
  assert.equal(nextUnlockedOf(LIVE, none, activeLevelOf(LIVE, none, '1-1')), null);
});

test('클리어하면 다음 스텝 버튼이 생긴다', () => {
  const passed = cleared11();
  assert.equal(nextUnlockedOf(LIVE, passed, '1-1'), '1-2');
});

test('버튼을 누르면 피드가 다음 스텝만 보여준다', () => {
  const passed = cleared11();
  const moved = activeLevelOf(LIVE, passed, '1-2');   // 눌러서 viewingLevel = '1-2'
  assert.equal(moved, '1-2');
  const feed = feedOf(LIVE, moved);
  assert.deepEqual([...new Set(feed.map(c => c.level))], ['1-2']);
  assert.ok(feed.length > 0);
});

test('아직 안 열린 스텝은 붙잡아 둘 수 없다 — 현재 진행 레벨로 되돌린다', () => {
  const none = new Set<string>();
  // 잠긴 2-1을 보려 해도 해금 목록에 없으므로 무시된다
  assert.equal(activeLevelOf(LIVE, none, '2-1'), '1-1');
});

test('마지막 스텝에서는 다음 스텝 버튼이 없다', () => {
  const all = new Set(LIVE.map(c => c.clip_id));
  const last = getLevels(LIVE)[getLevels(LIVE).length - 1];
  assert.equal(nextUnlockedOf(LIVE, all, last), null);
});

test('1-1~1-5 를 모두 끝내야 2-1 이 열린다', () => {
  const passed = new Set<string>();
  for (const lv of ['1-1', '1-2', '1-3', '1-4', '1-5']) {
    // 직전 단계에서 2-1 은 아직 안 열려 있어야 한다
    assert.equal(getUnlockedLevels(LIVE, passed).includes('2-1'), false, `${lv} 전에 2-1이 열림`);
    expressionsOfLevel(LIVE, lv).forEach(g => passed.add(g.clips[0].clip_id));
  }
  assert.ok(getUnlockedLevels(LIVE, passed).includes('2-1'), '1-5까지 끝내면 2-1 해금');
  assert.equal(nextUnlockedOf(LIVE, passed, '1-5'), '2-1');
});

// ── 10. 되돌아가기 ────────────────────────────────────────────
test('첫 스텝에서는 되돌아가기 버튼이 없다', () => {
  const none = new Set<string>();
  assert.equal(prevUnlockedOf(LIVE, none, '1-1'), null);
});

test('다음 스텝으로 옮기면 되돌아가기 버튼이 생긴다', () => {
  const passed = cleared11();
  assert.equal(prevUnlockedOf(LIVE, passed, '1-2'), '1-1');
});

test('되돌아가면 이전 스텝의 클립이 전부 다시 보인다 — 중복 장면 포함', () => {
  const passed = cleared11();
  const back = prevUnlockedOf(LIVE, passed, '1-2')!;
  const feed = feedOf(LIVE, activeLevelOf(LIVE, passed, back));
  assert.deepEqual([...new Set(feed.map(c => c.level))], ['1-1']);
  assert.equal(feed.length, 17, '통과 여부와 무관하게 17개 전부');
});

test('앞뒤로 오가도 해금 상태는 변하지 않는다', () => {
  const passed = cleared11();
  const before = getUnlockedLevels(LIVE, passed);
  activeLevelOf(LIVE, passed, '1-2');
  activeLevelOf(LIVE, passed, '1-1');
  assert.deepEqual(getUnlockedLevels(LIVE, passed), before);
});

// ── 9. 콘텐츠를 중간에 끼워 넣기 ───────────────────────────────
// 운영하면서 계속 생기는 일: "이 클립은 3번째 스텝에 들어가는 게 맞다".
// 10단위 번호(1-10, 1-20, …) 사이에 1-15 를 넣으면 기존 행은 하나도 안 고친다.
// 단, 진행 중이던 사용자가 뒤로 밀리면 안 된다.

const mk = (id: string, phrase: string, level: string, order: number): LevelClip =>
  ({ clip_id: id, target_phrase: phrase, level, level_order: order });

const SPACED: LevelClip[] = [
  mk('a1', 'Man on!', '1-10', 10), mk('a2', 'Time!', '1-10', 20),
  mk('b1', 'Hold!', '1-20', 10), mk('b2', 'Turn!', '1-20', 20),
  mk('c1', 'Press!', '1-30', 10), mk('c2', 'Drop!', '1-30', 20),
];
const SPACED_DONE = new Set(['a1', 'a2', 'b1', 'b2']); // 1-10, 1-20 클리어 → 1-30 진행 중

test('10단위 번호는 화면에서 스텝 1-1, 1-2, 1-3 으로 보인다', () => {
  assert.deepEqual(
    getLevels(SPACED).map(l => levelLabel(l, SPACED)),
    ['스텝 1-1', '스텝 1-2', '스텝 1-3'],
  );
});

test('1-10 과 1-20 사이에 1-15 를 끼우면 화면 번호가 자동으로 밀린다', () => {
  const inserted = [...SPACED, mk('x1', 'Switch it!', '1-15', 10)];
  assert.deepEqual(
    getLevels(inserted).map(l => levelLabel(l, inserted)),
    ['스텝 1-1', '스텝 1-2', '스텝 1-3', '스텝 1-4'],
  );
  assert.equal(levelLabel('1-15', inserted), '스텝 1-2');
  assert.equal(levelLabel('1-20', inserted), '스텝 1-3', '원래 1-2 였던 스텝이 1-3 으로 밀린다');
});

test('중간에 새 스텝이 끼어도 이미 열린 스텝이 다시 잠기지 않는다', () => {
  const before = getUnlockedLevels(SPACED, SPACED_DONE);
  assert.deepEqual(before, ['1-10', '1-20', '1-30']);

  const inserted = [...SPACED, mk('x1', 'Switch it!', '1-15', 10)];
  const after = getUnlockedLevels(inserted, SPACED_DONE);
  assert.ok(after.includes('1-30'), '진행 중이던 스텝이 잠기면 안 된다');
  assert.ok(after.includes('1-15'), '끼워 넣은 스텝도 열려 있어야 도장판에서 갈 수 있다');
  assert.equal(getCurrentLevel(inserted, SPACED_DONE), '1-30', '진행 자리를 지킨다');
});

test('이미 클리어한 스텝에 표현을 추가해도 진행 자리를 지킨다', () => {
  const passed = new Set(
    ['1-1', '1-2', '1-3', '1-4', '1-5'].flatMap(lv => expressionsOfLevel(LIVE, lv).map(g => g.clips[0].clip_id)),
  );
  assert.equal(getCurrentLevel(LIVE, passed), '2-1');

  // 1-3 에 새 표현을 하나 추가 — 그 스텝은 다시 미클리어가 된다
  const added = [...LIVE, mk('x2', 'Switch it!', '1-3', 25)];
  assert.equal(isLevelCleared(added, '1-3', passed), false);
  assert.equal(getCurrentLevel(added, passed), '2-1', '2-1 을 하던 사람이 1-3 으로 튕기면 안 된다');
  assert.ok(getUnlockedLevels(added, passed).includes('2-1'));
});

test('신규 유저 동작은 그대로 — 클리어가 없으면 첫 레벨만 열린다', () => {
  assert.deepEqual(getUnlockedLevels(SPACED, new Set()), ['1-10']);
  assert.equal(getCurrentLevel(SPACED, new Set()), '1-10');
});

// ── 10. 같은 표현의 장면 순서 ─────────────────────────────────
// 같은 표현의 영상이 여러 개일 때 어느 장면을 먼저 보여줄지 번호로 정한다.
// Man on 10, 11, 12 / Time 20, 21 — "작은 번호가 먼저" 하나로 통한다.

test('같은 표현의 장면은 번호 작은 것부터, 표현끼리는 번갈아 나온다', () => {
  const clips = [
    mk('m3', 'Man on!', '1-10', 12), mk('m1', 'Man on!', '1-10', 10), mk('m2', 'Man on!', '1-10', 11),
    mk('t2', 'Time!', '1-10', 21), mk('t1', 'Time!', '1-10', 20),
  ];
  assert.deepEqual(sortClipsByLevel(clips).map(c => c.clip_id), ['m1', 't1', 'm2', 't2', 'm3']);
});

test('장면 번호가 달라도 한 표현으로 묶인다 — 도장판 칸은 하나', () => {
  const clips = [mk('m1', 'Man on!', '1-10', 10), mk('m2', 'Man on!', '1-10', 11), mk('t1', 'Time!', '1-10', 20)];
  assert.equal(expressionsOfLevel(clips, '1-10').length, 2);
});

test('번호가 같으면 예전처럼 시트 행 순서를 따른다', () => {
  const clips = [mk('m1', 'Man on!', '1-10', 10), mk('m2', 'Man on!', '1-10', 10), mk('t1', 'Time!', '1-10', 20)];
  assert.deepEqual(sortClipsByLevel(clips).map(c => c.clip_id), ['m1', 't1', 'm2']);
});
