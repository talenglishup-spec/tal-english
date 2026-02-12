import { NextRequest, NextResponse } from 'next/server';
import { addLessonMaterial, deleteLessonMaterial } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { lessonId, materialId, action } = body;

        if (!lessonId || !materialId) {
            return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
        }

        if (action === 'remove') {
            await deleteLessonMaterial(lessonId, materialId);
        } else {
            // Default add
            await addLessonMaterial(lessonId, materialId);
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to update lesson material' }, { status: 500 });
    }
}
