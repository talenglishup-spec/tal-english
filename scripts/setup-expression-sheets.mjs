/**
 * setup-expression-sheets.mjs
 *
 * Validates and sets up the two new Google Sheets required for
 * the "오늘의 표현" (Today's Expressions) feature.
 *
 * Usage (from football-trainer/):
 *   node scripts/setup-expression-sheets.mjs
 */

import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config({ path: '.env.local' });

// ─── Credentials ─────────────────────────────────────────────────────────────

const SHEET_ID      = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/^"|"$/g, '');

// ─── Expected Sheet Schemas ───────────────────────────────────────────────────

const EXPRESSIONS_HEADERS = [
  'expression_id',  // uuid (e.g. expr-001)
  'lesson_id',      // YYYY-MM-DD — class session date
  'expression',     // English phrase (e.g. "give it a shot")
  'meaning_kr',     // Korean meaning
  'category',       // on-pitch | interview | life
  'example1',       // First example sentence (used for Cloze)
  'example2',       // Second example sentence
  'example3',       // Optional third example sentence
  'order',          // 1–5, ordering within the lesson
  'active',         // TRUE | FALSE
];

const EXPRESSION_PROGRESS_HEADERS = [
  'id',                  // uuid — attempt ID
  'player_id',           // student ID
  'expression_id',       // FK → Expressions sheet
  'lesson_id',           // YYYY-MM-DD
  'cloze_answer',        // what the student typed in Cloze step
  'cloze_score',         // 0–100 (admin-only)
  'speaking_audio_url',  // Supabase URL of recorded audio
  'speaking_completed',  // TRUE | FALSE
  'step_reached',        // 1–5: how far the student got
  'completed_at',        // ISO datetime of full completion
];

// ─── Sample Expressions (one lesson worth = 5 items) ─────────────────────────

const SAMPLE_EXPRESSIONS = [
  {
    expression_id: 'expr-001',
    lesson_id:     '2026-03-26',
    expression:    'give it a shot',
    meaning_kr:    '한번 해봐, 시도해봐',
    category:      'interview',
    example1:      "Why don't you give it a shot?",
    example2:      'I gave it a shot and it paid off.',
    example3:      'The manager told me to give it a shot.',
    order:         '1',
    active:        'TRUE',
  },
  {
    expression_id: 'expr-002',
    lesson_id:     '2026-03-26',
    expression:    'stay compact',
    meaning_kr:    '수비 라인을 좁게 유지해',
    category:      'on-pitch',
    example1:      'We need to stay compact at the back.',
    example2:      'Stay compact and cut off the space.',
    example3:      '',
    order:         '2',
    active:        'TRUE',
  },
  {
    expression_id: 'expr-003',
    lesson_id:     '2026-03-26',
    expression:    'read the game',
    meaning_kr:    '경기를 읽다, 흐름을 파악하다',
    category:      'on-pitch',
    example1:      'You have to read the game better.',
    example2:      'He reads the game so well.',
    example3:      '',
    order:         '3',
    active:        'TRUE',
  },
  {
    expression_id: 'expr-004',
    lesson_id:     '2026-03-26',
    expression:    'give everything',
    meaning_kr:    '모든 걸 쏟아붓다',
    category:      'interview',
    example1:      'I always give everything for the team.',
    example2:      "We gave everything but it wasn't enough.",
    example3:      '',
    order:         '4',
    active:        'TRUE',
  },
  {
    expression_id: 'expr-005',
    lesson_id:     '2026-03-26',
    expression:    'hold your shape',
    meaning_kr:    '대형(포메이션)을 유지해',
    category:      'on-pitch',
    example1:      "Hold your shape and don't chase the ball.",
    example2:      'The key is to hold your shape defensively.',
    example3:      '',
    order:         '5',
    active:        'TRUE',
  },
];

// ─── Logger ───────────────────────────────────────────────────────────────────

const log = {
  section: (t) => console.log(`\n${'─'.repeat(52)}\n  ${t}\n${'─'.repeat(52)}`),
  ok:      (t) => console.log(`  ✅  ${t}`),
  info:    (t) => console.log(`  ℹ️   ${t}`),
  warn:    (t) => console.log(`  ⚠️   ${t}`),
  error:   (t) => console.log(`  ❌  ${t}`),
};

// ─── Core: Verify or Create a Sheet ──────────────────────────────────────────

async function verifyOrCreateSheet(doc, title, expectedHeaders, sampleRows) {
  log.section(`Sheet: "${title}"`);

  let sheet = doc.sheetsByTitle[title];

  if (!sheet) {
    // ── Create new sheet ──────────────────────────────────────────
    log.info('Sheet not found → creating...');
    sheet = await doc.addSheet({ title, headerValues: expectedHeaders });
    log.ok(`Created with ${expectedHeaders.length} columns`);
    log.info(`Columns: ${expectedHeaders.join(' | ')}`);

    if (sampleRows?.length) {
      const rows = await sheet.getRows();
      if (rows.length === 0) {
        await sheet.addRows(sampleRows);
        log.ok(`Inserted ${sampleRows.length} sample rows`);
      }
    }
  } else {
    // ── Verify existing sheet ─────────────────────────────────────
    log.ok('Sheet already exists');
    await sheet.loadHeaderRow();
    const existing = sheet.headerValues ?? [];

    const missing = expectedHeaders.filter(h => !existing.includes(h));
    const extra   = existing.filter(h => !expectedHeaders.includes(h));

    if (missing.length === 0 && extra.length === 0) {
      log.ok(`All ${expectedHeaders.length} columns match`);
    } else {
      if (missing.length > 0) log.warn(`Missing columns → ${missing.join(', ')}`);
      if (extra.length > 0)   log.warn(`Unexpected columns → ${extra.join(', ')}`);
    }

    const rows = await sheet.getRows();
    log.info(`Current row count: ${rows.length}`);

    // Add sample data only if empty
    if (rows.length === 0 && sampleRows?.length) {
      await sheet.addRows(sampleRows);
      log.ok(`Inserted ${sampleRows.length} sample rows (sheet was empty)`);
    } else if (sampleRows?.length) {
      log.info('Skipping sample data — sheet already has data');
    }
  }

  return sheet;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🗂️  Expression Sheets — Validation & Setup');
  console.log('============================================');

  // 1. Environment check
  log.section('Step 1: Environment Variables');
  let envOk = true;
  if (!SHEET_ID)      { log.error('GOOGLE_SHEET_ID is not set');              envOk = false; }
  if (!SERVICE_EMAIL) { log.error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set'); envOk = false; }
  if (!PRIVATE_KEY)   { log.error('GOOGLE_PRIVATE_KEY is not set');           envOk = false; }
  if (!envOk) process.exit(1);

  log.ok(`Sheet ID        : ${SHEET_ID}`);
  log.ok(`Service Account : ${SERVICE_EMAIL}`);
  log.ok('Private Key     : [loaded]');

  // 2. Connect
  log.section('Step 2: Connecting to Google Sheets');
  const auth = new JWT({
    email:  SERVICE_EMAIL,
    key:    PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);

  try {
    await doc.loadInfo();
    log.ok(`Connected: "${doc.title}"`);
    const titles = Object.keys(doc.sheetsByTitle);
    log.info(`Existing sheets (${titles.length}): ${titles.join(', ')}`);
  } catch (err) {
    log.error(`Connection failed: ${err.message}`);
    process.exit(1);
  }

  // 3. Expressions sheet
  await verifyOrCreateSheet(
    doc,
    'Expressions',
    EXPRESSIONS_HEADERS,
    SAMPLE_EXPRESSIONS,
  );

  // 4. ExpressionProgress sheet
  await verifyOrCreateSheet(
    doc,
    'ExpressionProgress',
    EXPRESSION_PROGRESS_HEADERS,
    null, // no sample data — written by the app at runtime
  );

  // 5. Quick read-back test on Expressions
  log.section('Step 3: Read-back Verification');
  try {
    const exprSheet = doc.sheetsByTitle['Expressions'];
    const rows = await exprSheet.getRows();
    if (rows.length > 0) {
      log.ok(`Read ${rows.length} row(s) from Expressions`);
      const first = rows[0];
      log.info(`First row → expression: "${first.get('expression')}" | lesson: ${first.get('lesson_id')} | category: ${first.get('category')}`);
    } else {
      log.warn('Expressions sheet has no rows');
    }
  } catch (err) {
    log.warn(`Read-back failed: ${err.message}`);
  }

  // 6. Done
  log.section('Result');
  log.ok('Setup complete — both sheets are ready');
  console.log(`
  Next steps:
  ① Open your sheet and review the data:
     https://docs.google.com/spreadsheets/d/${SHEET_ID}

  ② Check "Expressions" tab → should have 5 sample rows for 2026-03-26
  ③ Check "ExpressionProgress" tab → should be empty (headers only)

  ④ When confirmed, proceed to Phase 2 (API implementation)
`);
}

main().catch(err => {
  console.error('\n  Fatal:', err.message ?? err);
  process.exit(1);
});
