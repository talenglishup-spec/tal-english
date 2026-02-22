require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
}));

doc.loadInfo().then(async () => {
    const sheet = doc.sheetsByTitle['SituationItems'];
    const rows = await sheet.getRows();
    let sitId = null;
    rows.forEach(r => {
        if (sitId !== r.get('situation_id')) {
            sitId = r.get('situation_id');
            console.log('SITUATION:', sitId, 'FIRST ITEM:', r.get('item_id'));
        }
    });

    const itemSheet = doc.sheetsByTitle['Items'];
    const irows = await itemSheet.getRows();
    const itemMap = new Map();
    irows.forEach(r => itemMap.set(r.get('item_id'), r.get('practice_type')));

    rows.forEach(r => {
        if (sitId !== r.get('situation_id')) {
            sitId = r.get('situation_id');
            console.log('   -> type:', itemMap.get(r.get('item_id')));
        }
    });
}).catch(console.error);
