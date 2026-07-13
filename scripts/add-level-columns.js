/**
 * 일회성 마이그레이션: Clips 시트에 표현 레벨 컬럼 2개를 추가하고,
 * 기존 speak_mode 클립에 시트 순서대로 S1부터 5개씩 배정한다.
 *   level        : "S1", "S2", ...
 *   level_order  : 레벨 내 순서 1~5
 *
 * 이미 값이 있는 행은 건드리지 않는다(idempotent).
 * 실행: node scripts/add-level-columns.js
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

const NEW_COLUMNS = ['level', 'level_order'];
const PER_LEVEL = 5;

async function main() {
    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Clips'];
    if (!sheet) throw new Error('"Clips" sheet not found');

    // 1) 헤더 추가
    await sheet.loadHeaderRow();
    const headers = [...sheet.headerValues];
    const missing = NEW_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length > 0) {
        const newHeaders = [...headers, ...missing];
        if (sheet.columnCount < newHeaders.length) {
            await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length });
        }
        await sheet.setHeaderRow(newHeaders);
        console.log(`컬럼 추가: ${missing.join(', ')}`);
    } else {
        console.log('컬럼은 이미 존재 — 배정만 확인합니다.');
    }

    // 2) speak_mode 클립에 시트 순서대로 S1부터 5개씩 배정 (빈 행만)
    const rows = await sheet.getRows();
    const speakRows = rows.filter(r =>
        (r.get('active') || '') === 'TRUE' &&
        (r.get('speak_mode') || '') === 'TRUE' &&
        (r.get('target_phrase') || '').trim() !== ''
    );

    let assigned = 0;
    for (let i = 0; i < speakRows.length; i++) {
        const row = speakRows[i];
        if ((row.get('level') || '').trim() !== '') {
            console.log(`[${row.get('clip_id')}] 스킵 (이미 ${row.get('level')})`);
            continue;
        }
        const levelNum = Math.floor(i / PER_LEVEL) + 1;
        const order = (i % PER_LEVEL) + 1;
        row.set('level', `S${levelNum}`);
        row.set('level_order', String(order));
        await row.save();
        console.log(`[${row.get('clip_id')}] → S${levelNum} #${order} ("${row.get('target_phrase')}")`);
        assigned++;
        await new Promise(r => setTimeout(r, 1100));
    }

    console.log(`\n완료 — 배정 ${assigned}개 / speak 클립 ${speakRows.length}개`);
}

main().catch(err => { console.error('마이그레이션 실패:', err.message); process.exit(1); });
