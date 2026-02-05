import { NextRequest, NextResponse } from 'next/server';
import { updateAttempt } from '@/utils/sheets';

export async function POST(req: NextRequest) {
    try {
        const { attemptId, coach_score, coach_feedback } = await req.json();

        if (!attemptId) {
            return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });
        }

        const success = await updateAttempt(attemptId, {
            coach_score: coach_score || '',
            coach_feedback: coach_feedback || ''
        });

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to update attempt' }, { status: 500 });
    }
}
