/**
 * 일회성 마이그레이션: Clips 시트에 AI 모범답안 TTS 컬럼 2개를 추가한다.
 *   model_audio_us | model_audio_uk
 * 이미 존재하면 no-op. 기존 데이터/컬럼은 건드리지 않는다(헤더 행만 확장).
 *
 * 실행: node scripts/add-model-audio-columns.js
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

const NEW_COLUMNS = ['model_audio_us', 'model_audio_uk'];

async function main() {
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Clips'];
    if (!sheet) throw new Error('"Clips" sheet not found');

    await sheet.loadHeaderRow();
    const headers = [...sheet.headerValues];
    console.log(`Current headers (${headers.length}):`, headers.join(' | '));

    const missing = NEW_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length === 0) {
        console.log('Both columns already exist — nothing to do.');
        return;
    }

    const newHeaders = [...headers, ...missing];

    // 그리드 컬럼 수가 부족하면 먼저 확장
    if (sheet.columnCount < newHeaders.length) {
        console.log(`Resizing grid: ${sheet.columnCount} → ${newHeaders.length} columns`);
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length });
    }

    await sheet.setHeaderRow(newHeaders);
    console.log(`Added columns: ${missing.join(', ')}`);
    console.log(`Final headers (${newHeaders.length}):`, newHeaders.join(' | '));
}

main().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
