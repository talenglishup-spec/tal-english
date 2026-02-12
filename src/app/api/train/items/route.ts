import { NextResponse } from 'next/server';
import { getItems, getPlayerItemsWithContext } from '@/utils/sheets';

// Prevent caching to ensure fresh data from Sheets
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');
        // lessonId param is mainly for specific lesson view (Review Page maybe? but Review Page uses Materials now)
        // Practice/Challenge uses playerId to get ALL assigned items.
        const lessonId = searchParams.get('lessonId');

        if (playerId) {
            // New Logic: Return Enriched Items with Lesson Context
            const items = await getPlayerItemsWithContext(playerId);
            return NextResponse.json({ items });
        }

        // Fallback or specific lesson logic
        let items = await getItems();

        if (lessonId) {
            const { getStructuredLessonContent } = await import('@/utils/sheets');
            const structured = await getStructuredLessonContent(lessonId);
            // Flatten structured content to list of items
            items = structured.flatMap(content => content.items);
        }


        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('Get Items Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
    }
}
