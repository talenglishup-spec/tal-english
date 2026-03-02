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

        const sheetsToCreate = [
            {
                title: 'ContentIntake',
                headers: ['active', 'player_id', 'lesson_no', 'lesson_title_ko', 'situation_order', 'situation_title_ko', 'item_order', 'category', 'subtype', 'practice_type', 'prompt_kr', 'target_en', 'cloze_target', 'expected_phrases', 'max_latency_ms', 'pattern_type', 'hint_guide', 'notes', 'item_id_override', 'lesson_id_override', 'situation_id_override']
            },
            {
                title: 'ReviewVideos',
                headers: ['active', 'video_id', 'title_ko', 'title_en', 'result_context', 'team_context', 'speaker_role', 'level', 'primary_tags', 'youtube_url', 'source_notes', 'linked_question_ids']
            },
            {
                title: 'InterviewQuestions',
                headers: ['active', 'question_id', 'question_en', 'question_ko', 'pattern_type', 'primary_tags', 'difficulty', 'followup_group_id']
            },
            {
                title: 'InterviewFollowups',
                headers: ['active', 'followup_id', 'followup_group_id', 'followup_en', 'followup_ko', 'difficulty']
            },
            {
                title: 'SyncLog',
                headers: ['timestamp', 'status', 'message', 'details']
            }
        ];

        for (const s of sheetsToCreate) {
            let sheet = doc.sheetsByTitle[s.title];
            if (!sheet) {
                console.log(`Creating sheet: ${s.title}...`);
                sheet = await doc.addSheet({ title: s.title, headerValues: s.headers });
                console.log(`✅ Created [${s.title}]`);
            } else {
                console.log(`[${s.title}] already exists. Updating headers...`);
                await sheet.loadHeaderRow().catch(() => { });

                // Merge new headers with existing if needed, or just overwrite
                const existingHeaders = [...sheet.headerValues];
                const newHeaders = s.headers;
                let updated = false;

                for (const h of newHeaders) {
                    if (!existingHeaders.includes(h)) {
                        existingHeaders.push(h);
                        updated = true;
                    }
                }

                if (updated) {
                    if (sheet.columnCount < existingHeaders.length) {
                        await sheet.resize({ rowCount: sheet.rowCount, columnCount: existingHeaders.length });
                    }
                    await sheet.setHeaderRow(existingHeaders);
                    console.log(`✅ Updated headers for [${s.title}]`);
                } else {
                    console.log(`ℹ️ [${s.title}] headers are up to date.`);
                }
            }
        }

        console.log('🎉 Done updating Google Sheets for v2.0+!');
    } catch (e) {
        console.error('Error updating sheets:', e);
    }
}

main();
