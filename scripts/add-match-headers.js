require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

async function main() {
    try {
        await doc.loadInfo();
        console.log(`Loaded doc: ${doc.title}`);

        const sheetsToUpdate = ['Items', 'ContentIntake'];
        const newHeaders = [
            'matched_question_id', 'matched_question_text', 'match_confidence', 'review_needed', 'match_source'
        ];

        for (const sheetName of sheetsToUpdate) {
            const sheet = doc.sheetsByTitle[sheetName];
            if (sheet) {
                await sheet.loadHeaderRow();
                const headers = [...sheet.headerValues];
                let updated = false;

                for (const h of newHeaders) {
                    if (!headers.includes(h)) {
                        headers.push(h);
                        updated = true;
                    }
                }

                if (updated) {
                    if (sheet.columnCount < headers.length) {
                        await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length });
                    }
                    await sheet.setHeaderRow(headers);
                    console.log(`✅ Added new match columns to [${sheetName}] sheet.`);
                } else {
                    console.log(`ℹ️ [${sheetName}] sheet already has the required columns.`);
                }
            } else {
                console.log(`❌ [${sheetName}] sheet not found!`);
            }
        }
        console.log('🎉 Done updating sheet headers!');
    } catch (e) {
        console.error('Error updating sheets:', e);
    }
}

main();
