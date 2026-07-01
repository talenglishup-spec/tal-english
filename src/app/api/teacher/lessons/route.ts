import { NextResponse } from 'next/server';
import { addLesson, getLessons } from '@/utils/sheets';
import { requireStaffAuth } from '@/utils/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    const auth = await requireStaffAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const lessons = await getLessons(); // No playerId means all lessons
        return NextResponse.json({ lessons });
    } catch (error: any) {
        console.error('Get All Lessons Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireStaffAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
