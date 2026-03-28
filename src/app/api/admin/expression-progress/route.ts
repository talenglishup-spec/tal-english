export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAllExpressionProgress, getExpressions } from '@/utils/sheets';

// GET /api/admin/expression-progress?lessonId=xxx
// Returns all players' expression progress grouped by player.
// Admin-only: cloze_score and speaking_audio_url are included.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get('lessonId') || undefined;

    try {
        const [progressData, expressions] = await Promise.all([
            getAllExpressionProgress(lessonId),
            getExpressions(lessonId),
        ]);

        // Build expression lookup map
        const exprMap = new Map(expressions.map(e => [e.expression_id, e]));

        // Group progress records by player
        const playerMap = new Map<string, {
            player_id: string;
            records: Array<{
                expression_id:      string;
                expression:         string;
                meaning_kr:         string;
                category:           string;
                mode:               string;
                completed:          boolean;
                cloze_score:        number;
                cloze_answer:       string;
                speaking_completed: boolean;
                speaking_audio_url: string;
                completed_at:       string;
            }>;
        }>();

        for (const p of progressData) {
            if (!playerMap.has(p.player_id)) {
                playerMap.set(p.player_id, { player_id: p.player_id, records: [] });
            }
            const expr = exprMap.get(p.expression_id);
            playerMap.get(p.player_id)!.records.push({
                expression_id:      p.expression_id,
                expression:         expr?.expression  || p.expression_id,
                meaning_kr:         expr?.meaning_kr  || '',
                category:           expr?.category    || '',
                mode:               p.mode,
                completed:          p.completed,
                cloze_score:        p.cloze_score,
                cloze_answer:       p.cloze_answer,
                speaking_completed: p.speaking_completed,
                speaking_audio_url: p.speaking_audio_url,
                completed_at:       p.completed_at,
            });
        }

        // Compute per-player completion rate
        const summary = Array.from(playerMap.values()).map(player => {
            const completedIds = new Set(
                player.records.filter(r => r.completed).map(r => r.expression_id)
            );
            const completion_rate = expressions.length > 0
                ? Math.round((completedIds.size / expressions.length) * 100)
                : 0;

            return { ...player, completion_rate };
        });

        return NextResponse.json({
            summary,
            total_expressions: expressions.length,
        });

    } catch (err: any) {
        console.error('[GET /api/admin/expression-progress]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
