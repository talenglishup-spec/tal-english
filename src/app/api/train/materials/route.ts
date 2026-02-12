import { NextRequest, NextResponse } from 'next/server';
import { getMaterialsForLesson } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const lessonId = searchParams.get('lessonId');

        if (!lessonId) {
            return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 });
        }

        const materials = await getMaterialsForLesson(lessonId);
        return NextResponse.json({ materials });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch lesson materials' }, { status: 500 });
    }
}
