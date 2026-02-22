require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
}));

doc.loadInfo().then(async () => {
    const sheet = doc.sheetsByTitle['Items'];
    const rows = await sheet.getRows();
    rows.slice(0, 15).forEach(r => {
        console.log(r.get('item_id'), " | type:", r.get('practice_type'), " | cloze:", r.get('cloze_target'), " | target_en:", r.get('target_en'));
    });
}).catch(console.error);
