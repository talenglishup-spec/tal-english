import { NextResponse } from 'next/server';
import { getAttempts, getItems } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const attempts = await getAttempts();
        const items = await getItems();

        // Return all attempts and items so frontend can aggregate
        return NextResponse.json({
            attempts,
            items
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch teacher data' }, { status: 500 });
    }
}
