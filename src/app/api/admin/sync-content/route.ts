import { NextResponse } from 'next/server';
import { getSheet } from '../../../../utils/sheets';
import crypto from 'crypto';

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
                        if (existingRow.get(k) !== v?.toString()) {
                            existingRow.set(k, v !== undefined ? v : '');
                            changed = true;
                        }
                    }
                    if (changed) await existingRow.save(); // Save only if dirty
                } else {
                    // Insert
                    await sheet.addRow(record);
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
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
