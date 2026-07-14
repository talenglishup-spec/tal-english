/**
 * 일회성 마이그레이션: Clips 시트에 챌린지 상황 콘텐츠 컬럼 2개를 추가한다.
 *   situation_image | situation_desc  (Phase 2 — 값은 콘텐츠 작업에서 채움)
 * 이미 존재하면 no-op. 실행: node scripts/add-situation-columns.js
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

const NEW_COLUMNS = ['situation_image', 'situation_desc'];

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

    await sheet.loadHeaderRow();
    const headers = [...sheet.headerValues];
    const missing = NEW_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length === 0) { console.log('컬럼 이미 존재 — no-op'); return; }

    const newHeaders = [...headers, ...missing];
    if (sheet.columnCount < newHeaders.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length });
    }
    await sheet.setHeaderRow(newHeaders);
    console.log(`컬럼 추가: ${missing.join(', ')} (총 ${newHeaders.length}개 헤더)`);
}

main().catch(err => { console.error('마이그레이션 실패:', err.message); process.exit(1); });
