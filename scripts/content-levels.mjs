/**
 * 콘텐츠 레벨 관리 도구 — level / level_order 점검·미리보기·재번호
 *
 *   node scripts/content-levels.mjs              점검 + 화면 미리보기 + 다음에 쓸 번호
 *   node scripts/content-levels.mjs --sortkey    정렬용 sort_key 컬럼 갱신(--apply 로 반영)
 *   node scripts/content-levels.mjs --renumber   10단위 재번호 계획만 출력(시트 안 건드림)
 *   node scripts/content-levels.mjs --renumber --apply   실제로 시트에 반영
 *
 * 판정은 앱과 같은 코드(src/lib/levels.ts)를 그대로 import해서 한다 —
 * "시트에서 괜찮아 보이는데 앱에서 이상한" 상황을 막으려면 같은 로직이어야 한다.
 */
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'node:fs';
import path from 'node:path';
import {
  levelRank, levelLabel, getLevels, clipsOfLevel, expressionsOfLevel,
  expressionKeyOf, stageKeyOf, sortClipsByLevel,
} from '../src/lib/levels.ts';
import { splitCaption } from '../src/lib/caption.ts';

for (const f of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

const RENUMBER = process.argv.includes('--renumber');
const SORTKEY = process.argv.includes('--sortkey');
const APPLY = process.argv.includes('--apply');
const STEP = 10; // 새 번호 간격 — 사이에 9개를 더 끼울 수 있다

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
}));
await doc.loadInfo();
const sheet = doc.sheetsByTitle['Clips'];
await sheet.loadHeaderRow();
const rows = await sheet.getRows();

const isTrue = v => String(v ?? '').trim().toUpperCase() === 'TRUE';
const clips = rows
  .filter(r => isTrue(r.get('active')))
  .map(r => ({
    row: r.rowNumber,
    clip_id: r.get('clip_id') || `행${r.rowNumber}`,
    target_phrase: r.get('target_phrase') || '',
    level: String(r.get('level') || '').trim(),
    level_order: parseInt(r.get('level_order') || '0', 10) || 0,
    category: String(r.get('category') || '').trim(),
    script_en: String(r.get('script_en') || '').trim(),
    youtube_url: String(r.get('youtube_url') || '').trim(),
    start_sec: String(r.get('start_sec') || '').trim(),
    end_sec: String(r.get('end_sec') || '').trim(),
    // scene 은 예전 이름이 context_tag 였다 — 둘 중 있는 쪽을 읽는다
    scene: String(r.get('scene') ?? r.get('context_tag') ?? '').trim(),
    speak: isTrue(r.get('speak_mode')),
    _row: r,
  }));

const LEVEL_RE = /^(\d+-\d+|WARM-\d+|ENC|REF|S\d+|-)$/i;
// 분류 값은 여섯 개뿐이다. 새 카테고리는 표현이 8개 이상 모였을 때 올린다
// (빈 카테고리는 학생에게 "콘텐츠 없는 앱"으로 보인다).
const CATEGORIES = ['수비', '공격', '전환·리셋', '워밍업', '심판', '격려'];
const SCENES = ['훈련', '경기', '인터뷰', '생활'];
// 선수가 한 호흡에 외칠 수 있는 길이. 넘으면 코치 설명일 가능성이 높다.
const PHRASE_WARN = 6;
const PHRASE_FATAL = 12;
const wordsOf = p => String(p).trim().split(/\s+/).filter(Boolean).length;
const fatal = [];
const warn = [];
const info = []; // 고칠 필요는 없지만 알아두면 좋은 것

// ── 1. 형식·누락 ───────────────────────────────────────────────
for (const c of clips) {
  if (!c.level) { fatal.push(`${c.clip_id} (${c.row}행) level 비어 있음`); continue; }
  if (!LEVEL_RE.test(c.level)) fatal.push(`${c.clip_id} (${c.row}행) level 형식 오류: "${c.level}" — 1-2 / WARM-1 / ENC / REF 만 인식됩니다`);
  if (c.level !== '-' && !c.level_order) fatal.push(`${c.clip_id} (${c.row}행) level_order 비어 있음 — 순서가 0으로 밀립니다`);
  if (!c.target_phrase.trim()) fatal.push(`${c.clip_id} (${c.row}행) target_phrase 비어 있음`);

  // 분류 — 오타는 필터를 조용히 망가뜨리므로 치명으로 잡는다
  if (c.category && !CATEGORIES.includes(c.category)) {
    fatal.push(`${c.clip_id} (${c.row}행) category 허용 외 값: "${c.category}" — ${CATEGORIES.join(' / ')} 중 하나`);
  }
  if (c.scene && !SCENES.includes(c.scene)) {
    fatal.push(`${c.clip_id} (${c.row}행) scene 허용 외 값: "${c.scene}" — ${SCENES.join(' / ')} 중 하나`);
  }
  if (!c.category) warn.push(`${c.clip_id} (${c.row}행) category 비어 있음 — 필터에서 빠집니다`);

  // 자막 문장이 따로 있으면, 말할 말이 그 안에 실제로 들려야 한다.
  // 안 들리는 말을 시키면 듣기 연습도 말하기 연습도 성립하지 않는다.
  if (c.script_en) {
    const marked = splitCaption(c.script_en, c.target_phrase).some(p => p.hit);
    if (!marked) {
      fatal.push(`${c.clip_id} (${c.row}행) script_en 안에 target_phrase("${c.target_phrase}")가 없습니다 — 들리지 않는 말을 시키게 됩니다`);
    }
    const sn = wordsOf(c.script_en);
    if (sn > 40) warn.push(`${c.clip_id} (${c.row}행) script_en ${sn}단어 — 자막이 길어 화면을 덮습니다. 들려줄 구간을 줄이세요`);
  }

  // 말하기 과제 길이 — 긴 코치 설명을 그대로 올리면 그 스텝에서 막힌다
  const n = wordsOf(c.target_phrase);
  if (c.speak && n > PHRASE_FATAL) {
    fatal.push(`${c.clip_id} (${c.row}행) target_phrase ${n}단어 — 선수가 통째로 말하기 어렵습니다. 핵심만 남기거나 active를 끄세요`);
  } else if (c.speak && n > PHRASE_WARN) {
    warn.push(`${c.clip_id} (${c.row}행) target_phrase ${n}단어 — 코치 설명이면 핵심만 자르는 편이 낫습니다`);
  }
}

// ── 1-b. 같은 영상의 같은 구간이 두 번 ──────────────────────────
// 같은 장면이 두 번 들어가면 학생이 똑같은 영상을 두 번 본다.
// 시각만 같고 영상이 다른 경우는 흔하므로(우연히 3:29에서 시작) 반드시
// 영상 주소까지 함께 본다.
{
  const bySegment = new Map();
  for (const c of clips) {
    if (!c.youtube_url || !c.start_sec) continue;
    const key = `${c.youtube_url}|${c.start_sec}|${c.end_sec}`;
    if (!bySegment.has(key)) bySegment.set(key, []);
    bySegment.get(key).push(c);
  }
  for (const [, group] of bySegment) {
    if (group.length < 2) continue;
    const where = `${group.map(c => `${c.clip_id}(${c.row}행)`).join(', ')} — ${group[0].start_sec}~${group[0].end_sec}`;
    const phrases = new Set(group.map(c => expressionKeyOf(c)));
    if (phrases.size === 1) {
      // 같은 장면 · 같은 표현 → 학생이 똑같은 영상을 두 번 본다
      warn.push(`같은 영상의 같은 구간·같은 표현이 ${group.length}번: ${where}`);
    } else {
      // 한 장면에서 표현을 나눈 경우(의도된 분리). 다만 멈추는 지점이 같으면
      // 분리한 의미가 없다 — 둘 다 같은 자리에서 멈춘다.
      const pauses = new Set(group.map(c => c._row ? String(c._row.get('pause_at') ?? '').trim() : ''));
      if (pauses.size === 1) {
        warn.push(`한 장면에서 표현 ${group.length}개인데 멈춤 지점이 같음: ${where} — 각 표현이 끝나는 시각으로 나눠 주세요`);
      } else {
        info.push(`한 장면에서 표현 ${group.length}개(의도된 분리로 봄): ${where}`);
      }
    }
  }
}

// ── 2. 순서가 애매한 곳 ─────────────────────────────────────────
// 번호가 같으면 시트 행 순서로 정해진다 — 시트를 정렬하면 바뀌므로 알려준다.
for (const lv of getLevels(clips)) {
  for (const g of expressionsOfLevel(clips, lv)) {
    const nums = g.clips.map(c => c.level_order);
    if (new Set(nums).size < nums.length) {
      info.push(`${lv} "${g.clip.target_phrase}" 장면 ${nums.length}개 중 번호가 같은 것이 있음(${nums.join(', ')}) — ${nums[0] % STEP === 0 ? `순서를 정하려면 ${nums[0]}, ${nums[0] + 1}, ${nums[0] + 2}…처럼` : '10단위 전환(--renumber) 때 지금 순서대로 10, 11, 12…로 정리됩니다'}`);
    }
  }
  const firstNums = expressionsOfLevel(clips, lv).map(g => Math.min(...g.clips.map(c => c.level_order)));
  const dup = firstNums.filter((n, i) => firstNums.indexOf(n) !== i);
  if (dup.length) warn.push(`${lv} 서로 다른 표현이 같은 시작 번호(${[...new Set(dup)].join(', ')}) — 어느 표현이 먼저인지 시트 행 순서에 달림`);
  const exprCount = expressionsOfLevel(clips, lv).length;
  if (exprCount > 0 && exprCount < 3) warn.push(`${lv} 표현 ${exprCount}개뿐 — 한 스텝이 너무 얇습니다(3개 이상 권장)`);
}

// ── 출력: 점검 ─────────────────────────────────────────────────
const levels = getLevels(clips);
const totalExpr = levels.reduce((n, lv) => n + expressionsOfLevel(clips, lv).length, 0);
console.log(`\n━━ 콘텐츠 점검 ━━`);
console.log(`활성 ${clips.length}클립 · 레벨 ${levels.length}개 · 표현 ${totalExpr}개`);
const catCount = CATEGORIES.map(k => `${k} ${clips.filter(c => c.category === k).length}`).join(' · ');
const noCat = clips.filter(c => !c.category).length;
console.log(`분류: ${catCount}${noCat ? ` · 미분류 ${noCat}` : ''}`);
console.log(`\n${fatal.length ? '✗' : '✓'} 치명 ${fatal.length}건`);
fatal.forEach(m => console.log('   ' + m));
console.log(`${warn.length ? '!' : '✓'} 주의 ${warn.length}건`);
warn.forEach(m => console.log('   ' + m));
if (info.length) { console.log(`· 참고 ${info.length}건`); info.forEach(m => console.log('   ' + m)); }

// ── sort_key: 시트를 앱 순서대로 정렬하기 위한 파생 컬럼 ──────────
// level 은 텍스트라 시트 기본 정렬이 1-10 을 1-2 앞에 놓는다. 손으로 컬럼을
// 쪼개 숫자로 만드는 대신, 앱이 실제로 쓰는 순서(sortClipsByLevel — 라운드로빈
// 포함)의 몇 번째인지를 그대로 써 준다. 이 컬럼으로 정렬하면 시트가 위에서
// 아래로 "사용자가 보는 순서"가 된다. 앱은 이 컬럼을 읽지 않는다.
if (SORTKEY) {
  const order = sortClipsByLevel(clips);
  const keyOf = new Map(order.map((c, i) => [c.clip_id, i + 1]));
  let col = sheet.headerValues.indexOf('sort_key');
  console.log(`
━━ sort_key 갱신 ━━`);
  console.log(`${clips.length}개 행에 1~${order.length} 순번을 씁니다 — 이 컬럼으로 정렬하면 시트가 앱 피드 순서가 됩니다.`);
  if (col < 0) console.log(`(sort_key 컬럼이 없어 맨 뒤에 새로 만듭니다 — 앱은 이 컬럼을 읽지 않습니다)`);
  order.slice(0, 8).forEach(c => console.log(`   ${String(keyOf.get(c.clip_id)).padStart(3)}  ${c.level.padEnd(6)} ${c.target_phrase}`));
  console.log(`   …`);
  if (!APPLY) { console.log(`
(미리보기입니다. 실제로 반영하려면 --apply 를 붙이세요)
`); process.exit(0); }

  if (col < 0) {
    await sheet.setHeaderRow([...sheet.headerValues, 'sort_key']);
    col = sheet.headerValues.indexOf('sort_key');
  }
  const lastRow = Math.max(...clips.map(c => c.row));
  await sheet.loadCells({ startRowIndex: 0, endRowIndex: lastRow, startColumnIndex: col, endColumnIndex: col + 1 });
  for (const c of clips) sheet.getCell(c.row - 1, col).value = keyOf.get(c.clip_id) ?? '';
  await sheet.saveUpdatedCells();
  console.log(`
✓ sort_key 를 갱신했습니다. 시트에서 그 컬럼 기준 오름차순 정렬하면 앱 순서와 같습니다.
`);
  process.exit(0);
}

if (!RENUMBER) {
  // ── 화면 미리보기 ───────────────────────────────────────────
  console.log(`\n━━ 앱 화면에 이렇게 보입니다 ━━`);
  const nextOf = n => (n % STEP === 0 ? n + STEP : n + 1); // 10단위면 +10, 아직 1,2,3…이면 +1
  for (const lv of levels) {
    const groups = expressionsOfLevel(clips, lv);
    const feed = clipsOfLevel(clips, lv);
    console.log(`\n${levelLabel(lv, clips)}   (시트 "${lv}")   표현 ${groups.length} · 클립 ${feed.length}`);
    groups.forEach(g => console.log(`   ${String(g.clip.target_phrase).slice(0, 34).padEnd(34)} 번호 ${g.clips.map(c => c.level_order).sort((a, b) => a - b).join(', ')}`));
    console.log(`   피드 순서: ${feed.slice(0, 8).map(c => c.target_phrase).join(' → ')}${feed.length > 8 ? ' → …' : ''}`);
  }

  // ── 다음에 쓸 번호 ──────────────────────────────────────────
  console.log(`\n━━ 다음에 추가할 때 쓸 번호 ━━`);
  for (const lv of levels) {
    // 표현마다 시작 번호(가장 작은 번호)만 본다 — 장면 번호(11, 12…)는 그 표현 몫
    const used = [...new Set(expressionsOfLevel(clips, lv).map(g => Math.min(...g.clips.map(c => c.level_order))))].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 0; i < used.length - 1; i++) {
      if (used[i + 1] - used[i] >= 2) gaps.push(`${used[i]}~${used[i + 1]} 사이`);
    }
    console.log(`   ${lv.padEnd(7)} 끝에 추가 → ${nextOf(used[used.length - 1])}${gaps.length ? ` · 중간 삽입 가능: ${gaps.join(', ')}` : ' · 중간 삽입 불가(연속) → --renumber 권장'}`);
  }
  const stages = [...new Set(levels.map(l => stageKeyOf(l)).filter(Boolean))];
  for (const st of stages.filter(s => /^\d+$/.test(s))) {
    const inStage = levels.filter(l => stageKeyOf(l) === st).map(l => parseInt(l.split('-')[1], 10)).sort((a, b) => a - b);
    // 스텝 사이에 새 스텝을 끼울 수 있는 번호 — 두 번호 차이가 2 이상이어야 가능
    const between = [];
    for (let i = 0; i < inStage.length - 1; i++) {
      const [lo, hi] = [inStage[i], inStage[i + 1]];
      if (hi - lo >= 2) between.push(`${st}-${lo}과 ${st}-${hi} 사이 → ${st}-${Math.floor((lo + hi) / 2)}`);
    }
    console.log(`   ${st}군 맨 뒤 새 스텝 → ${st}-${nextOf(inStage[inStage.length - 1])}`);
    if (between.length) between.forEach(b => console.log(`           중간 삽입: ${b}`));
    else console.log(`           중간 삽입 불가(번호가 연속) → --renumber 후 가능`);
  }
  console.log(`\n중복 클립(같은 표현 다른 영상)은 기존 표현과 "같은 슬롯 번호"를 주세요 — 그래야 피드에서 흩어집니다.\n`);
  process.exit(fatal.length ? 1 : 0);
}

// ── 재번호 계획 ────────────────────────────────────────────────
const plan = []; // { row, clip_id, levelFrom, levelTo, orderFrom, orderTo }
for (const st of [...new Set(levels.map(l => stageKeyOf(l)).filter(Boolean))]) {
  const stLevels = levels.filter(l => stageKeyOf(l) === st).sort((a, b) => levelRank(a) - levelRank(b));
  stLevels.forEach((lv, li) => {
    // 숫자 군만 코드 재부여. WARM/ENC/REF는 코드 유지(순서만 정리)
    const levelTo = /^\d+$/.test(st) ? `${st}-${(li + 1) * STEP}`
      : /^WARM/i.test(lv) ? `WARM-${(li + 1) * STEP}` : lv;

    // 표현을 현재 피드 순서대로 세워 10단위 번호를 주고, 같은 표현의 장면은
    // 지금 나오는 순서대로 10, 11, 12… — 이후 장면 순서를 번호로 바꿀 수 있다.
    const groups = expressionsOfLevel(clips, lv);
    groups.forEach((g, gi) => {
      g.clips.forEach((c, si) => {
        const orderTo = (gi + 1) * STEP + si;
        if (c.level === levelTo && c.level_order === orderTo) return;
        plan.push({ row: c.row, clip_id: c.clip_id, phrase: c.target_phrase, levelFrom: c.level, levelTo, orderFrom: c.level_order, orderTo, _row: c._row });
      });
    });
  });
}

console.log(`\n━━ 재번호 계획 (${STEP}단위) ━━`);
console.log(`바뀌는 행: ${plan.length}개 / 활성 ${clips.length}개`);
console.log(`화면 표시(스텝 1-1, 1-2 …)는 그대로입니다 — 앱이 순번을 다시 계산하기 때문입니다.`);
console.log(`진행 기록도 영향 없습니다 — clip_id 기준이라 레벨 코드와 무관합니다.\n`);
for (const p of plan.slice(0, 60)) {
  const lv = p.levelFrom === p.levelTo ? p.levelTo.padEnd(9) : `${p.levelFrom} → ${p.levelTo}`.padEnd(14);
  console.log(`   ${String(p.row).padStart(4)}행 ${p.clip_id.padEnd(14)} ${lv} 번호 ${String(p.orderFrom).padStart(3)} → ${String(p.orderTo).padStart(3)}  ${String(p.phrase).slice(0, 28)}`);
}
if (plan.length > 60) console.log(`   … 외 ${plan.length - 60}개`);

if (!APPLY) {
  console.log(`\n(미리보기입니다. 실제로 반영하려면 --apply 를 붙이세요)\n`);
  process.exit(0);
}

// ── 시트 반영 ──────────────────────────────────────────────────
const colLevel = sheet.headerValues.indexOf('level');
const colOrder = sheet.headerValues.indexOf('level_order');
if (colLevel < 0 || colOrder < 0) { console.error('level / level_order 헤더를 못 찾았습니다.'); process.exit(1); }
const maxRow = Math.max(...plan.map(p => p.row));
await sheet.loadCells({ startRowIndex: 0, endRowIndex: maxRow, startColumnIndex: Math.min(colLevel, colOrder), endColumnIndex: Math.max(colLevel, colOrder) + 1 });
for (const p of plan) {
  sheet.getCell(p.row - 1, colLevel).value = p.levelTo;
  sheet.getCell(p.row - 1, colOrder).value = p.orderTo;
}
await sheet.saveUpdatedCells();
console.log(`\n✓ ${plan.length}개 행을 시트에 반영했습니다. 어드민에서 "쇼츠 콘텐츠 새로고침"을 눌러 주세요.\n`);
