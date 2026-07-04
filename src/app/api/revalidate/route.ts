import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clearSheetCache } from '@/lib/sheets';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const secret = searchParams.get('secret');

        // Check for secret to prevent unauthorized cache clearing.
        // Fallback to a default if ADMIN_TOKEN is not set in environment yet.
        const validToken = process.env.ADMIN_TOKEN || 'tal2026';

        if (secret !== validToken) {
            return NextResponse.json({ error: 'Invalid secret token' }, { status: 401 });
        }

        // 1. Clear Next.js Route Cache for content items
        revalidatePath('/api/content/items');
        
        // 2. Clear Next.js Page Cache for related routes
        revalidatePath('/home');
        revalidatePath('/shorts');
        
        // 3. Clear In-memory Sheets Cache
        clearSheetCache();

        return NextResponse.json({
            revalidated: true,
            now: Date.now(),
            message: 'Cache successfully cleared. The application will fetch fresh data from Google Sheets on the next request.',
            path_revalidated: ['/api/content/items', '/home', '/shorts']
        });
    } catch (err: any) {
        return NextResponse.json({ error: 'Error revalidating', message: err.message }, { status: 500 });
    }
}
