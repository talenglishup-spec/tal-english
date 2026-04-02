require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function verify() {
    const auth = new JWT({
        email: process.env.SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['ContentIntake'];
    const rows = await sheet.getRows();
    const l39Rows = rows.filter(r => r.get('lesson_no') === '39');
    
    console.log(`Found ${l39Rows.length} rows for Lesson 39 in ContentIntake.`);
    l39Rows.slice(-5).forEach(r => {
        console.log(` - [${r.get('item_id_override')}] ${r.get('prompt_kr')}`);
    });
}
verify();
