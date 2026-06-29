import { NextResponse } from 'next/server';
import { getInterviewQuestions, getPlayer } from '@/utils/sheets';
import { INTERVIEW_SCENARIOS } from '@/constants/interviewScenarios';

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const playerId = searchParams.get('player_id');
        const scenarioId = searchParams.get('scenario_id');

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
        }

        const [allQuestions, player] = await Promise.all([
            getInterviewQuestions(),
            getPlayer(playerId)
        ]);

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const level = player.level || 'L1';
        let limit = 10;
        let allowedLevels = ['L1'];

        if (level === 'L2') {
            limit = 20;
            allowedLevels = ['L1', 'L2'];
        } else if (level === 'L3') {
            limit = 30;
            allowedLevels = ['L1', 'L2', 'L3'];
        }

        // Filter based on allowed levels
        let pool = allQuestions.filter(q => allowedLevels.includes(q.min_level || 'L1'));

        // If scenarioId is provided, filter by scenario tags
        if (scenarioId) {
            const scenario = INTERVIEW_SCENARIOS.find(s => s.id === scenarioId);
            if (scenario) {
                pool = pool.filter(q => {
                    const tags = (q.scenario_tags || '').toUpperCase();
                    return tags.includes('ALL') || tags.includes(scenario.type);
                });
            }
        }

        // Sort by frequency_rank (1 is most important)
        pool = pool.sort((a, b) => (a.frequency_rank || 999) - (b.frequency_rank || 999));

        // Take top N questions
        let selectedQuestions = pool.slice(0, limit);

        // Shuffle the selected questions for the challenge session
        selectedQuestions = shuffle(selectedQuestions);

        // Map them to look like EnrichedItems for ClozeDrillApp
        const challengeItems = selectedQuestions.map(q => ({
            id: q.question_id,
            prompt_kr: q.question_ko,
            target_en: q.sample_answer || '', // Sample answer is hidden
            category: 'interview',
            sub_category: 'Top 30 Interview',
            level: q.difficulty || q.min_level,
            lesson_id: 'interview_challenge',
            lesson_no: 0,
            lesson_note: '',
            challenge_type: 'INTERVIEW_ENQ_TO_EN' as const,
            question_text: q.question_en,
            hint_keywords: q.hint_keywords,
            scenario_id: scenarioId || undefined,
            // Since it's interview challenge, we want to play the EN TTS for question_en
        }));

        return NextResponse.json({
            success: true,
            items: challengeItems
        });

    } catch (e: any) {
        console.error('Interview API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
