/**
 * sync-interview-questions.js
 *
 * question_master.csv → Google Sheets [InterviewQuestions] 병합 동기화
 *
 * 동작 방식:
 *  - 기존 시트 데이터를 로드 (question_ko, sample_answer 등 수동 입력 필드 보존)
 *  - CSV를 읽어 매핑 후 병합 (신규 → 추가, 기존 → CSV 기반 필드만 업데이트)
 *
 * 실행: node scripts/sync-interview-questions.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// ── 설정 ──────────────────────────────────────────────────────────────────────

const CSV_PATH = path.resolve(
    'C:/Users/sangha.lee/Desktop/Clips/tal_factory/data/master/question_master.csv'
);

const DRY_RUN = process.argv.includes('--dry-run');

// ── Google Sheets 인증 ────────────────────────────────────────────────────────

const SHEET_ID      = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .replace(/^"|"$/g, '');

const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

// ── CSV 파싱 (탭 구분, cp949) ─────────────────────────────────────────────────

function parseCSV(filePath) {
    // iconv-lite 없이 Node 내장 Buffer + cp949 디코딩 시도
    // Node.js 기본은 cp949를 지원하지 않으므로 iconv-lite 사용
    let iconv;
    try {
        iconv = require('iconv-lite');
    } catch {
        throw new Error('iconv-lite 패키지가 필요합니다. npm install iconv-lite --save-dev 로 설치하세요.');
    }

    const raw = fs.readFileSync(filePath);
    const text = iconv.decode(raw, 'cp949');
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t').map(c => c.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
        if (row.question_id) rows.push(row);
    }

    return rows;
}

// ── intent_type → pattern_type 매핑 ──────────────────────────────────────────

const INTENT_TO_PATTERN = {
    'Evaluation':    'tactical',
    'Tactical':      'tactical',
    'Emotional':     'emotional',
    'Mental':        'emotional',
    'Positive':      'positive',
    'Opposition':    'defensive',
    'Construction':  'tactical',
    'Instruction':   'tactical',
};

function toPatternType(intentType) {
    return INTENT_TO_PATTERN[intentType?.trim()] || 'emotional';
}

// ── step_min → difficulty 매핑 ────────────────────────────────────────────────

function toDifficulty(stepMin) {
    const n = parseInt(stepMin, 10) || 3;
    if (n <= 3) return '1';
    if (n <= 6) return '2';
    return '3';
}

// ── step_min → min_level 매핑 ─────────────────────────────────────────────────

function toMinLevel(stepMin) {
    const n = parseInt(stepMin, 10) || 3;
    return n >= 7 ? 'L2' : 'L1';
}

// ── CSV 행 → InterviewQuestions 시트 필드 변환 ────────────────────────────────

function csvRowToSheetRow(csvRow, rank, existingSheetRow) {
    // 수동 입력 필드는 기존 시트 데이터 우선 보존
    const question_ko   = existingSheetRow?.question_ko   || '';
    const sample_answer = existingSheetRow?.sample_answer || '';
    const followup_group_id = existingSheetRow?.followup_group_id || '';

    // notes + intent_type 조합으로 primary_tags 생성
    const tags = [];
    if (csvRow.notes)       tags.push(csvRow.notes.trim());
    if (csvRow.intent_type) tags.push(csvRow.intent_type.trim());
    const primary_tags = tags.join(', ');

    return {
        active:           'TRUE',
        question_id:      csvRow.question_id,
        question_en:      csvRow.question_text,
        question_ko,
        pattern_type:     toPatternType(csvRow.intent_type),
        primary_tags,
        difficulty:       toDifficulty(csvRow.step_min),
        followup_group_id,
        frequency_rank:   String(rank),
        min_level:        toMinLevel(csvRow.step_min),
        sample_answer,
    };
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(DRY_RUN ? '🔍 [DRY RUN 모드] 실제 변경 없음\n' : '🚀 동기화 시작\n');

    // 1. CSV 로드 및 파싱
    console.log(`📂 CSV 로드: ${CSV_PATH}`);
    const csvRows = parseCSV(CSV_PATH);
    console.log(`   → ${csvRows.length}개 질문 로드 완료`);

    // 2. frequency_rank 계산 (total_count 내림차순 → 1위부터)
    const sorted = [...csvRows].sort((a, b) => parseInt(b.total_count, 10) - parseInt(a.total_count, 10));
    const rankMap = {};
    sorted.forEach((row, idx) => { rankMap[row.question_id] = idx + 1; });

    // 3. Google Sheets 로드
    console.log('\n📊 Google Sheets 로드 중...');
    await doc.loadInfo();
    console.log(`   → 문서: ${doc.title}`);

    const sheet = doc.sheetsByTitle['InterviewQuestions'];
    if (!sheet) {
        console.error('❌ InterviewQuestions 시트를 찾을 수 없습니다.');
        process.exit(1);
    }

    const existingRows = await sheet.getRows();
    console.log(`   → 현재 시트: ${existingRows.length}개 행`);

    // 기존 시트 데이터를 question_id 기준으로 맵핑
    const existingMap = {};
    existingRows.forEach(row => {
        const qid = row.get('question_id');
        if (qid) {
            existingMap[qid] = {
                rowRef:          row,
                question_ko:     row.get('question_ko')     || '',
                sample_answer:   row.get('sample_answer')   || '',
                followup_group_id: row.get('followup_group_id') || '',
            };
        }
    });

    // 4. 병합 처리
    let updated = 0;
    let added   = 0;
    const toAdd = [];

    for (const csvRow of csvRows) {
        const rank = rankMap[csvRow.question_id];
        const existing = existingMap[csvRow.question_id];
        const newData = csvRowToSheetRow(csvRow, rank, existing);

        if (existing) {
            // 기존 행 업데이트 (CSV 기반 필드만)
            const row = existing.rowRef;
            const changed =
                row.get('question_en')     !== newData.question_en      ||
                row.get('pattern_type')    !== newData.pattern_type      ||
                row.get('primary_tags')    !== newData.primary_tags      ||
                row.get('difficulty')      !== newData.difficulty         ||
                row.get('frequency_rank')  !== newData.frequency_rank    ||
                row.get('min_level')       !== newData.min_level;

            if (changed) {
                console.log(`  ✏️  UPDATE: ${csvRow.question_id} - ${csvRow.question_text.substring(0, 40)}`);
                if (!DRY_RUN) {
                    row.set('question_en',    newData.question_en);
                    row.set('pattern_type',   newData.pattern_type);
                    row.set('primary_tags',   newData.primary_tags);
                    row.set('difficulty',     newData.difficulty);
                    row.set('frequency_rank', newData.frequency_rank);
                    row.set('min_level',      newData.min_level);
                    await row.save();
                }
                updated++;
            } else {
                console.log(`  ✅ OK    : ${csvRow.question_id}`);
            }
        } else {
            // 신규 행 추가 예정
            console.log(`  ➕ ADD   : ${csvRow.question_id} - ${csvRow.question_text.substring(0, 40)}`);
            toAdd.push(newData);
            added++;
        }
    }

    // 5. 신규 행 일괄 추가
    if (toAdd.length > 0 && !DRY_RUN) {
        await sheet.addRows(toAdd);
    }

    // 6. 결과 요약
    console.log('\n' + '─'.repeat(50));
    console.log(`📊 결과 요약`);
    console.log(`   CSV 질문 수:  ${csvRows.length}개`);
    console.log(`   업데이트:     ${updated}개`);
    console.log(`   신규 추가:    ${added}개`);
    console.log(`   변경 없음:    ${csvRows.length - updated - added}개`);
    if (DRY_RUN) console.log('\n⚠️  DRY RUN: 실제 변경은 적용되지 않았습니다. 실행하려면 --dry-run 없이 다시 실행하세요.');
    else         console.log('\n🎉 동기화 완료!');
}

main().catch(e => {
    console.error('❌ 오류:', e.message || e);
    process.exit(1);
});
