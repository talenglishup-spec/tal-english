import { NextResponse } from 'next/server';
import { getAttempts, getItems } from '@/utils/sheets';
import { requireStaffAuth } from '@/utils/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requireStaffAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
