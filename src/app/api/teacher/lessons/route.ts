import { NextResponse } from 'next/server';
import { addLesson } from '@/utils/sheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Validation?
        await addLesson(body);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Add Lesson Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
