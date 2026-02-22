import { NextResponse } from 'next/server';
import { getStructuredLessonContent } from '@/utils/sheets';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
        return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 });
    }

    try {
        const content = await getStructuredLessonContent(lessonId);
        return NextResponse.json({ content });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch lesson content' }, { status: 500 });
    }
}
