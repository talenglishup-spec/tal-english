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

        // 1. Items Sheet
        const itemsSheet = doc.sheetsByTitle['Items'];
        if (itemsSheet) {
            await itemsSheet.loadHeaderRow();
            const headers = [...itemsSheet.headerValues]; // clone
            const newHeaders = [
                'category', 'subtype', 'pattern_type', 'intent_tags', 'answer_role', 'variation_examples',
                'followup_group_id', 'expected_phrases', 'max_latency_ms', 'trigger_audio_url', 'difficulty_level'
            ];
            let updated = false;

            for (const h of newHeaders) {
                if (!headers.includes(h)) {
                    headers.push(h);
                    updated = true;
                }
            }

            if (updated) {
                // Ensure the sheet has enough columns by resizing if needed
                if (itemsSheet.columnCount < headers.length) {
                    await itemsSheet.resize({ rowCount: itemsSheet.rowCount, columnCount: headers.length });
                }
                await itemsSheet.setHeaderRow(headers);
                console.log('✅ Successfully added new columns to [Items] sheet.');
            } else {
                console.log('ℹ️ [Items] sheet already has the required columns.');
            }
        } else {
            console.log('❌ [Items] sheet not found!');
        }

        // 2. Attempts Sheet
        const attemptsSheet = doc.sheetsByTitle['Attempts'] || doc.sheetsByIndex[0];
        if (attemptsSheet) {
            await attemptsSheet.loadHeaderRow();
            const headers = [...attemptsSheet.headerValues];
            const newHeaders = [
                'latency_ms', 'sentence_count', 'repetition_score', 'pattern_selected', 'structure_score',
                'status', 'error_message', 'created_at', 'finalized_at'
            ];
            let updated = false;

            for (const h of newHeaders) {
                if (!headers.includes(h)) {
                    headers.push(h);
                    updated = true;
                }
            }
            if (updated) {
                if (attemptsSheet.columnCount < headers.length) {
                    await attemptsSheet.resize({ rowCount: attemptsSheet.rowCount, columnCount: headers.length });
                }
                await attemptsSheet.setHeaderRow(headers);
                console.log('✅ Successfully added new columns to [Attempts] sheet.');
            } else {
                console.log('ℹ️ [Attempts] sheet already has the required columns.');
            }
        } else {
            console.log('❌ [Attempts] sheet not found!');
        }

        console.log('🎉 Done updating sheets!');
    } catch (e) {
        console.error('Error updating sheets:', e);
    }
}

main();
