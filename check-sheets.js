require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
}));

doc.loadInfo().then(() => {
    const sheet = doc.sheetsByTitle['Items'];
    sheet.getRows().then(rows => {
        console.log("Total rows:", rows.length);
        rows.slice(0, 10).forEach(r => {
            console.log(r.get('item_id'), '| practice_type:', r.get('practice_type'), '| active:', r.get('active'));
        });
    });
}).catch(console.error);
