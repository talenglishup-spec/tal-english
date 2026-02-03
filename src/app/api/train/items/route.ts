import { NextResponse } from 'next/server';
import { getItems } from '@/utils/sheets';

// Prevent caching to ensure fresh data from Sheets
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const items = await getItems();
        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('Get Items Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
    }
}
