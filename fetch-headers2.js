const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function run() {
    console.log('Starting...');
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    let out = 'Document Title: ' + doc.title + '\n';
    for (let i = 0; i < doc.sheetCount; i++) {
        const sheet = doc.sheetsByIndex[i];
        await sheet.loadHeaderRow();
        out += '\nSheet: ' + sheet.title + '\n';
        out += 'Columns: ' + sheet.headerValues.join(', ') + '\n';
    }
    fs.writeFileSync('sheet-info.txt', out, 'utf8');
    console.log('Done!');
}
run().catch(console.error);
