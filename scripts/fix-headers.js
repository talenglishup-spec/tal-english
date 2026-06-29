require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

async function fixHeaders() {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['InterviewQuestions'];
    await sheet.loadHeaderRow();
    
    // Replace with the correct headers our code needs
    await sheet.setHeaderRow([
        'active', 'question_id', 'question_en', 'question_ko', 
        'pattern_type', 'primary_tags', 'difficulty', 
        'followup_group_id', 'frequency_rank', 'min_level', 
        'sample_answer', 'scenario_tags', 'hint_keywords'
    ]);
    console.log("Headers updated successfully!");
}

fixHeaders().catch(console.error);
