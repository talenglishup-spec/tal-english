import { NextResponse } from 'next/server';
import { getSheet } from '../../../../utils/sheets';
import crypto from 'crypto';
import { findBestMatch, recordCandidate } from '../../../../utils/question-matcher';

// Function to safely pad numbers
const pad2 = (num: number) => num.toString().padStart(2, '0');

export async function POST(req: Request) {
    try {
        const token = req.headers.get('x-admin-token');
        if (token !== process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } // Allow if ADMIN_TOKEN is not set for local dev

        const intakeSheet = await getSheet('ContentIntake');
        const logSheet = await getSheet('SyncLog');

        const logSync = async (status: string, message: string, details: string = '') => {
            if (logSheet) {
                try {
                    await logSheet.addRow({
                        timestamp: new Date().toISOString(),
                        status,
                        message,
                        details
                    });
                } catch (e) { console.error('Log failed', e); }
            }
        };

        if (!intakeSheet) {
            await logSync('error', 'ContentIntake sheet missing');
            return NextResponse.json({ error: 'ContentIntake sheet missing' }, { status: 400 });
        }

        const rows = await intakeSheet.getRows();
        await logSync('success', 'Sync Started', `Found ${rows.length} intake rows`);

        // State to keep track of generated / existing
        const newLessons = new Map<string, any>();
        const newSituations = new Map<string, any>();
        const newItems = new Map<string, any>();
        const newSituationItems = new Map<string, any>();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === 'true' || activeVal === true;
            if (!isActive) continue; // Skip inactive

            try {
                const playerId = row.get('player_id');
                const lessonNo = Number(row.get('lesson_no'));
                const situationOrder = Number(row.get('situation_order'));
                const itemOrder = Number(row.get('item_order'));

                // Perform Auto-Matching if missing
                let matchedId = row.get('matched_question_id') || '';
                let matchedText = row.get('matched_question_text') || '';
                let matchConfidence = Number(row.get('match_confidence')) || 0;
                let reviewNeeded = row.get('review_needed') === 'TRUE' || row.get('review_needed') === 'true';

                // If we have a question text but no ID, try to match
                const inputQuestion = row.get('question_text') || row.get('matched_question_text') || '';
                if (!matchedId && inputQuestion) {
                    const match = findBestMatch(inputQuestion);
                    if (match.matched_id && match.confidence >= 85) {
                        matchedId = match.matched_id;
                        matchConfidence = match.confidence;
                        // For auto-matches from engine, we can set review_needed if confidence is not perfect
                        if (match.confidence < 95) reviewNeeded = true;
                    } else {
                        // Record as candidate for later review
                        await recordCandidate(inputQuestion, match.suggested_id);
                        reviewNeeded = true;
                    }
                }

                if (!playerId || !lessonNo || !situationOrder || !itemOrder) {
                    await logSync('warning', `Skipped row ${i + 2} due to missing required relation fields (player_id, lesson_no, etc)`);
                    continue;
                }

                // Auto ID generation rules
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

                // Validation rules
                let category = (row.get('category') || 'practice').toLowerCase();
                if (!['onpitch', 'interview', 'practice', 'build', 'weak', 'assemble'].includes(category)) category = 'practice';

                let practiceType = row.get('practice_type') || 'A';
                if (!['A', 'B'].includes(practiceType.toUpperCase())) practiceType = 'A';

                const maxLatency = Number(row.get('max_latency_ms')) || (category === 'onpitch' ? 1500 : 2000);

                // Prepare Items
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
                        matched_question_id: matchedId,
                        matched_question_text: matchedText,
                        question_text: row.get('question_text') || matchedText || '',
                        match_confidence: matchConfidence,
                        review_needed: reviewNeeded,
                        active: true
                    });
                }

                // Prepare Lessons
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

                // Prepare Situations
                if (!newSituations.has(situationId)) {
                    newSituations.set(situationId, {
                        situation_id: situationId,
                        lesson_id: lessonId,
                        situation_title_ko: row.get('situation_title_ko') || '',
                        situation_order: situationOrder,
                        active: true,
                    });
                }

                // Prepare SituationItems
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
            } catch (err: any) {
                await logSync('warning', `Error processing row ${i + 2}`, err.message);
            }
        }

        // Upsert Functions for each sheet
        const upsertSheet = async (sheetName: string, idField: string, newRecordsMap: Map<string, any>, compoundIdFields?: string[]) => {
            const sheet = await getSheet(sheetName);
            if (!sheet) return;
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

            for (const [key, record] of Array.from(newRecordsMap.entries())) {
                const existingRow = existingMap.get(key);
                if (existingRow) {
                    // Update
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
                            await existingRow.save(); // Save only if dirty
                            await new Promise(r => setTimeout(r, 1000)); // Respect quota (increased to 1000ms)
                        } catch (e: any) {
                            console.error(`Save failed for row ${key}`, e.message);
                            throw new Error(`Save failed for ${sheetName} row ${key}: ${e.message}`);
                        }
                    }
                } else {
                    // Insert
                    try {
                        await sheet.addRow(record);
                        await new Promise(r => setTimeout(r, 800)); // Respect quota (increased from 500ms)
                    } catch (e: any) {
                        console.error(`Add failed for row`, record, e.message);
                        throw new Error(`Add failed for ${sheetName}: ${e.message}`);
                    }
                }
            }
        };

        // Execute Upserts mapping
        await upsertSheet('Items', 'item_id', newItems);
        await upsertSheet('Lessons', 'lesson_id', newLessons);
        await upsertSheet('LessonSituations', 'situation_id', newSituations);
        // SituationItems uses compound logic (situation_id + item_id)
        await upsertSheet('SituationItems', '', newSituationItems, ['situation_id', 'item_id']);

        await logSync('success', 'Sync Completed', `Lessons: ${newLessons.size}, Situations: ${newSituations.size}, Items: ${newItems.size}`);

        return NextResponse.json({ success: true, message: 'Content intake synced successfully' });

    } catch (e: any) {
        console.error('API Error:', e.message || e);
        // Attempt to log fatal error to sheet
        try {
            const logSheet = await getSheet('SyncLog');
            if (logSheet) {
                await logSheet.addRow({
                    timestamp: new Date().toISOString(),
                    status: 'error',
                    message: 'FATAL API ERROR',
                    details: e.message || 'Unknown'
                });
            }
        } catch (logErr) {
            console.error('Failed to log fatal error to sheet', logErr);
        }

        // Include detailed error if available (e.g. 429 Quota Exceeded)
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: e.message || 'Unknown error occurred during sync'
        }, { status: 500 });
    }
}
