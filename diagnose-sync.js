const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

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

const pad2 = (num) => num.toString().padStart(2, '0');

async function getSheet(title) {
    await doc.loadInfo();
    return doc.sheetsByTitle[title];
}

async function runSync() {
    console.log("Starting Full Sync Simulation...");
    try {
        const intakeSheet = await getSheet('ContentIntake');
        if (!intakeSheet) {
            console.error('ContentIntake sheet missing');
            return;
        }

        const rows = await intakeSheet.getRows();
        console.log(`Found ${rows.length} intake rows`);

        const newLessons = new Map();
        const newSituations = new Map();
        const newItems = new Map();
        const newSituationItems = new Map();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === 'true' || activeVal === true;
            if (!isActive) continue;

            try {
                const playerId = row.get('player_id');
                const lessonNo = Number(row.get('lesson_no'));
                const situationOrder = Number(row.get('situation_order'));
                const itemOrder = Number(row.get('item_order'));

                if (!playerId || !lessonNo || !situationOrder || !itemOrder) {
                    console.log(`Skipped row ${i + 2} due to missing fields`);
                    continue;
                }

                const lessonId = row.get('lesson_id_override') || `LSN_${playerId}_${lessonNo}`;
                const situationId = row.get('situation_id_override') || `SIT_${lessonId}_${pad2(situationOrder)}`;
                const targetEn = row.get('target_en') || '';

                let itemId = row.get('item_id_override');
                if (!itemId) {
                    if (targetEn && targetEn.trim().length > 0) {
                        const hash = crypto.createHash('sha256').update(targetEn.trim().toLowerCase()).digest('hex').substring(0, 6);
                        itemId = `I_${hash}`;
                    } else {
                        itemId = `ITM_${situationId}_${pad2(itemOrder)}`;
                    }
                }

                let category = (row.get('category') || 'practice').toLowerCase();
                let practiceType = row.get('practice_type') || 'A';
                const maxLatency = Number(row.get('max_latency_ms')) || (category === 'onpitch' ? 1500 : 2000);

                if (!newItems.has(itemId)) {
                    newItems.set(itemId, {
                        item_id: itemId,
                        category,
                        subtype: row.get('subtype') || '',
                        practice_type: practiceType,
                        prompt_kr: row.get('prompt_kr') || '',
                        target_en: targetEn,
                        cloze_target: row.get('cloze_target') || '',
                        expected_phrases: row.get('expected_phrases') || '',
                        max_latency_ms: maxLatency,
                        pattern_type: row.get('pattern_type') || '',
                        coach_note: row.get('hint_guide') || '',
                        matched_question_id: row.get('matched_question_id') || '',
                        matched_question_text: row.get('matched_question_text') || '',
                        match_confidence: Number(row.get('match_confidence')) || 0,
                        review_needed: row.get('review_needed') === 'TRUE' || row.get('review_needed') === 'true',
                        active: true
                    });
                }

                if (!newLessons.has(lessonId)) {
                    newLessons.set(lessonId, {
                        lesson_id: lessonId,
                        player_id: playerId,
                        lesson_no: lessonNo,
                        lesson_title_ko: row.get('lesson_title_ko') || '',
                        lesson_type: category || 'mixed',
                        note: row.get('notes') || '',
                        active: true
                    });
                }

                if (!newSituations.has(situationId)) {
                    newSituations.set(situationId, {
                        situation_id: situationId,
                        lesson_id: lessonId,
                        situation_title_ko: row.get('situation_title_ko') || '',
                        situation_order: situationOrder,
                        active: true,
                    });
                }

                const sitItemId = `${situationId}_${itemId}`;
                if (!newSituationItems.has(sitItemId)) {
                    newSituationItems.set(sitItemId, {
                        situation_id: situationId,
                        item_id: itemId,
                        item_order: itemOrder,
                        active: true,
                        note: row.get('notes') || ''
                    });
                }
            } catch (err) {
                console.error(`Error processing row ${i + 2}:`, err.message);
            }
        }

        const upsertSheet = async (sheetName, idField, newRecordsMap, compoundIdFields) => {
            console.log(`Upserting [${sheetName}]...`);
            const sheet = await getSheet(sheetName);
            if (!sheet) { console.error(`Sheet [${sheetName}] not found`); return; }
            
            const existingRows = await sheet.getRows();
            const existingMap = new Map();

            existingRows.forEach(row => {
                if (compoundIdFields) {
                    const key = compoundIdFields.map(f => row.get(f)).join('_');
                    existingMap.set(key, row);
                } else {
                    existingMap.set(row.get(idField), row);
                }
            });

            const entries = Array.from(newRecordsMap.entries());
            console.log(`Processing ${entries.length} records for ${sheetName}`);
            
            for (const [key, record] of entries) {
                const existingRow = existingMap.get(key);
                if (existingRow) {
                    let changed = false;
                    for (const [k, v] of Object.entries(record)) {
                        const currentVal = existingRow.get(k);
                        const newVal = (v !== undefined && v !== null) ? v.toString() : '';
                        if (currentVal !== newVal) {
                            existingRow.set(k, newVal);
                            changed = true;
                        }
                    }
                    if (changed) {
                        try {
                            await existingRow.save();
                            console.log(`Updated row ${key}`);
                            await new Promise(r => setTimeout(r, 800));
                        } catch (e) {
                            console.error(`Save failed for row ${key}`, e.message);
                            throw e; // Rethrow to see full error
                        }
                    }
                } else {
                    try {
                        await sheet.addRow(record);
                        console.log(`Added row ${key}`);
                    } catch (e) {
                        console.error(`Add failed for row ${key}`, e.message);
                        throw e;
                    }
                }
            }
        };

        // run upserts
        await upsertSheet('Items', 'item_id', newItems);
        await upsertSheet('Lessons', 'lesson_id', newLessons);
        await upsertSheet('LessonSituations', 'situation_id', newSituations);
        await upsertSheet('SituationItems', '', newSituationItems, ['situation_id', 'item_id']);

        console.log("Simulation successful!");

    } catch (e) {
        console.error("SIMULATION FAILED:", e);
    }
}

runSync();
