export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
    getExpressions,
    getExpressionsByCategory,
    getExpressionProgress,
    getAllExpressionLessons,
    type ExpressionProgressRow,
} from '@/utils/sheets';

type Mode = 'view' | 'cloze' | 'speaking' | 'flashcard';
const ALL_MODES: Mode[] = ['view', 'cloze', 'speaking', 'flashcard'];

function selectMode(
    expressionIds: string[],
    history: ExpressionProgressRow[]
): Mode {
    const seenIds = new Set(history.map(h => h.expression_id));
    const hasNew  = expressionIds.some(id => !seenIds.has(id));

    if (hasNew) return 'view';

    // Exclude the most recently used mode to avoid back-to-back repeats
    const sorted   = [...history].sort((a, b) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
    const lastMode = sorted[0]?.mode;
    const available = lastMode ? ALL_MODES.filter(m => m !== lastMode) : ALL_MODES;
    return available[Math.floor(Math.random() * available.length)];
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lessonId  = searchParams.get('lessonId')  || undefined;
    const category  = searchParams.get('category')  || undefined;
    const playerId  = searchParams.get('playerId')  || undefined;
    const allLessons = searchParams.get('allLessons') === 'true';

    try {
        // ── Return all lesson IDs that have expressions (for review tab list) ──
        if (allLessons) {
            const lessonIds = await getAllExpressionLessons();
            return NextResponse.json({ lessonIds });
        }

        // ── Fetch expressions ─────────────────────────────────────────────────
        const expressions = category
            ? await getExpressionsByCategory(category)
            : await getExpressions(lessonId);

        if (!expressions.length) {
            return NextResponse.json({ expressions: [], mode: 'view', progress: {} });
        }

        // ── If playerId given, calculate mode + attach progress ───────────────
        if (playerId) {
            const history = await getExpressionProgress(playerId, lessonId);
            const mode    = selectMode(expressions.map(e => e.expression_id), history);

            // Map progress by expression_id for easy client lookup
            const progressMap = Object.fromEntries(
                history.map(p => [p.expression_id, p])
            );

            return NextResponse.json({ expressions, mode, progress: progressMap });
        }

        return NextResponse.json({ expressions, mode: 'view', progress: {} });

    } catch (err: any) {
        console.error('[GET /api/expressions]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
