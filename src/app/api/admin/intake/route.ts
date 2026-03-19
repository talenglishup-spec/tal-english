import { NextResponse } from 'next/server';
import { getSheet } from '../../../../utils/sheets';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid rows data' }, { status: 400 });
        }

        const intakeSheet = await getSheet('ContentIntake');
        if (!intakeSheet) {
            return NextResponse.json({ error: 'ContentIntake sheet not found' }, { status: 404 });
        }

        // Map UI rows to Sheet columns
        const sheetRows = rows.map(r => ({
            active: r.active !== undefined ? r.active.toString().toUpperCase() : 'TRUE',
            player_id: r.player_id,
            lesson_no: r.lesson_no,
            lesson_title_ko: r.lesson_title_ko || '',
            situation_order: r.situation_order,
            situation_title_ko: r.situation_title_ko || '',
            item_order: r.item_order,
            category: r.category || 'interview',
            subtype: r.subtype || '',
            practice_type: r.practice_type || 'A',
            prompt_kr: r.prompt_kr,
            target_en: r.target_en,
            cloze_target: r.cloze_target || '',
            expected_phrases: r.expected_phrases || '',
            max_latency_ms: r.max_latency_ms || 2000,
            pattern_type: r.pattern_type || '',
            hint_guide: r.hint_guide || '',
            notes: r.notes || '',
        }));

        await intakeSheet.addRows(sheetRows);

        return NextResponse.json({ success: true, count: sheetRows.length });
    } catch (e: any) {
        console.error('Intake Append Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
