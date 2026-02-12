import { NextResponse } from 'next/server';
import { getSheet } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sheet = await getSheet('Players');
        if (!sheet) {
            return NextResponse.json({ error: 'Players sheet not found' }, { status: 500 });
        }

        const rows = await sheet.getRows();
        const players = rows.map(row => ({
            player_id: row.get('player_id'),
            player_name: row.get('player_name'),
            active: row.get('active') === 'TRUE' || row.get('active') === true || row.get('active') === 'true'
        })).filter(p => p.active);

        return NextResponse.json({ players });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }
}
