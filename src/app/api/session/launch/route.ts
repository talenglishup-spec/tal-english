import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSheet } from '@/utils/sheets';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mode, source, video_id, question_ids, include_followup } = body;

        const session_id = uuidv4();
        let final_questions: string[] = [];

        if (mode === 'assemble') {
            // Take up to 2 questions
            final_questions = Array.isArray(question_ids) ? question_ids.slice(0, 2) : [];
        } else if (mode === 'challenge') {
            // Randomly select 1 question
            const qList = Array.isArray(question_ids) ? question_ids : [];
            if (qList.length > 0) {
                const randomQId = qList[Math.floor(Math.random() * qList.length)];
                final_questions.push(randomQId);

                if (include_followup) {
                    // Find the followup group for this question
                    const qSheet = await getSheet('InterviewQuestions');
                    if (qSheet) {
                        const qRows = await qSheet.getRows();
                        const qRow = qRows.find(r => r.get('question_id') === randomQId);
                        const groupId = qRow?.get('followup_group_id');

                        if (groupId) {
                            const fSheet = await getSheet('InterviewFollowups');
                            if (fSheet) {
                                const fRows = await fSheet.getRows();
                                const groupFollowups = fRows.filter(r => {
                                    const activeVal = r.get('active');
                                    const isActive = activeVal === 'TRUE' || activeVal === 'true' || activeVal === true;
                                    return isActive && r.get('followup_group_id') === groupId;
                                });

                                if (groupFollowups.length > 0) {
                                    const randomFollowup = groupFollowups[Math.floor(Math.random() * groupFollowups.length)];
                                    // Make sure it's clear it's a followup ID, though front-end can fetch this specifically.
                                    final_questions.push(randomFollowup.get('followup_id') || '');
                                }
                            }
                        }
                    }
                }
            }
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        const buildParams = new URLSearchParams();
        buildParams.set('session_id', session_id);
        if (source) buildParams.set('source', source);
        if (video_id) buildParams.set('video_id', video_id);
        if (final_questions.length > 0) buildParams.set('q', final_questions.join(','));

        const redirect_url = `/train/${mode}?${buildParams.toString()}`;

        return NextResponse.json({
            success: true,
            data: {
                session_id,
                redirect_url,
                selected_questions: final_questions
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: 'Failed to launch session', details: err.message }, { status: 500 });
    }
}
