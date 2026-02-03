import { NextRequest, NextResponse } from 'next/server';
import { getAttempts, updateAttempt } from '@/utils/sheets';

export async function GET() {
    try {
        const attempts = await getAttempts();
        return NextResponse.json({ attempts });
    } catch (error: any) {
        console.error('Get Attempts Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch attempts' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { attempt_id, coach_score, coach_feedback } = body;

        if (!attempt_id) {
            return NextResponse.json({ error: 'Missing attempt_id' }, { status: 400 });
        }

        // Convert coach_score to string if it's a number, or keep as is
        const success = await updateAttempt(attempt_id, {
            coach_score: String(coach_score),
            coach_feedback: String(coach_feedback || ''),
        });

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }
    } catch (error: any) {
        console.error('Update Attempt Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update attempt' }, { status: 500 });
    }
}
