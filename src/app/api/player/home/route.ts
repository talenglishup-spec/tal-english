import { NextResponse } from 'next/server';
import { getSheet } from '@/utils/sheets';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const playerId = searchParams.get('player_id');

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
        }

        const lessonsSheet = await getSheet('Lessons');
        if (!lessonsSheet) {
            return NextResponse.json({ error: 'Lessons sheet not found' }, { status: 500 });
        }

        const rows = await lessonsSheet.getRows();

        let highestLesson: any = null;

        for (const row of rows) {
            const active = row.get('active');
            if (active !== 'TRUE' && active !== 'true' && active !== true) continue;
            if (row.get('player_id') !== playerId) continue;

            const lessonNo = Number(row.get('lesson_no'));
            const updatedAtDate = row.get('updated_at') ? new Date(row.get('updated_at')).getTime() : 0;

            if (!highestLesson) {
                highestLesson = {
                    lesson_id: row.get('lesson_id'),
                    lesson_no: lessonNo,
                    lesson_title_ko: row.get('lesson_title_ko'),
                    updated_at_ms: updatedAtDate
                };
            } else {
                if (updatedAtDate > highestLesson.updated_at_ms) {
                    highestLesson = {
                        lesson_id: row.get('lesson_id'),
                        lesson_no: lessonNo,
                        lesson_title_ko: row.get('lesson_title_ko'),
                        updated_at_ms: updatedAtDate
                    };
                } else if (updatedAtDate === highestLesson.updated_at_ms && lessonNo > highestLesson.lesson_no) {
                    highestLesson = {
                        lesson_id: row.get('lesson_id'),
                        lesson_no: lessonNo,
                        lesson_title_ko: row.get('lesson_title_ko'),
                        updated_at_ms: updatedAtDate
                    };
                }
            }
        }

        return NextResponse.json({
            success: true,
            mostRecentLesson: highestLesson
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
