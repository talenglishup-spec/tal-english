import { NextResponse } from 'next/server';
import { getSheet, appendAttempt, updateAttempt } from '@/utils/sheets';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { player_id, daily_id } = body;

        if (!player_id || !daily_id) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const attemptsSheet = await getSheet('Attempts');
        if (!attemptsSheet) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
        }

        const rows = await attemptsSheet.getRows();

        let existingRow: any = null;
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (row.get('player_id') === player_id && row.get('daily_id') === daily_id && row.get('item_id') === 'DLY_COMPLETED') {
                existingRow = row;
                break;
            }
        }

        if (existingRow) {
            // Repeat path
            const currentCount = Number(existingRow.get('repeat_count') || 0);
            existingRow.set('repeat_count', currentCount + 1);
            await existingRow.save();
            return NextResponse.json({ success: true, message: 'Repeat count updated', repeat_count: currentCount + 1 });
        } else {
            // First time path
            await appendAttempt({
                attempt_id: daily_id + '_' + Date.now(),
                date_time: new Date().toISOString(),
                player_id,
                session_id: daily_id,
                session_mode: 'daily',
                item_id: 'DLY_COMPLETED',
                challenge_type: '',
                status: 'finalized',
                created_at: new Date().toISOString(),
                finalized_at: new Date().toISOString(),
                daily_id: daily_id,
                repeat_count: 0
            } as any);
            return NextResponse.json({ success: true, message: 'Daily saved successfully', repeat_count: 0 });
        }
    } catch (e: any) {
        console.error('Save Daily complete error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
