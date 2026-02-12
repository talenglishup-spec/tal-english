import { NextResponse } from 'next/server';
import { addLessonItem, deleteLessonItem } from '@/utils/sheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lessonId, itemId } = body;
        await addLessonItem(lessonId, itemId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Add Lesson Item Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const lessonId = searchParams.get('lessonId');
        const itemId = searchParams.get('itemId');

        if (!lessonId || !itemId) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        await deleteLessonItem(lessonId, itemId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Lesson Item Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
