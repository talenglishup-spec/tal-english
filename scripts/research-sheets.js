require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function checkConfig() {
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
    
    try {
        await doc.loadInfo();
        console.log(`Title: ${doc.title}`);
        
        const lessonsSheet = doc.sheetsByTitle['Lessons'];
        if (lessonsSheet) {
            const rows = await lessonsSheet.getRows();
            console.log("\nRecent Lessons:");
            const start = Math.max(0, rows.length - 10);
            rows.slice(start).forEach(r => {
                console.log(` - Lesson ${r.get('lesson_no')}: ${r.get('lesson_id')} (Player: ${r.get('player_id')})`);
            });
        }

        const playersSheet = doc.sheetsByTitle['Players'];
        if (playersSheet) {
            const rows = await playersSheet.getRows();
            console.log("\nRegistered Players:");
            rows.forEach(r => console.log(` - ${r.get('player_id')}: ${r.get('player_name')}`));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

checkConfig();
