import { NextResponse } from 'next/server';
import { getSheet } from '../../../../utils/sheets';

const MATCHER_API = process.env.TAL_MATCHER_URL || 'http://localhost:8502';

interface MatchResult {
    atom_id: string | null;
    question_ids: string[];
    primary_question_id: string | null;
    primary_question_text: string | null;
    confidence: number;
    source: string;
    is_new_atom: boolean;
    review_needed: boolean;
}

/**
 * 매처 서버에 문장 → 질문 매칭 요청
 */
async function fetchMatchedQuestion(
    sentence: string,
    category: string
): Promise<MatchResult | null> {
    try {
        const res = await fetch(`${MATCHER_API}/match-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence, category }),
            signal: AbortSignal.timeout(5000), // 5초 타임아웃
        });
        if (!res.ok) return null;
        return await res.json() as MatchResult;
    } catch {
        // 매처 서버 미실행 시 조용히 무시 (null 반환)
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid rows data' }, { status: 400 });
        }

        const intakeSheet = await getSheet('ContentIntake');
        if (!intakeSheet) {
            return NextResponse.json({ error: 'ContentIntake sheet not found' }, { status: 404 });
        }

        // 모든 문장에 대해 질문 매칭 병렬 실행
        const matchResults = await Promise.all(
            rows.map(r => fetchMatchedQuestion(r.target_en || '', r.category || 'interview'))
        );

        // Map UI rows to Sheet columns (질문 매칭 정보 포함)
        const sheetRows = rows.map((r, idx) => {
            const match: MatchResult | null = matchResults[idx];
            return {
                active:              r.active !== undefined ? r.active.toString().toUpperCase() : 'TRUE',
                player_id:          r.player_id,
                lesson_no:          r.lesson_no,
                lesson_title_ko:    r.lesson_title_ko || '',
                situation_order:    r.situation_order,
                situation_title_ko: r.situation_title_ko || '',
                item_order:         r.item_order,
                category:           r.category || 'interview',
                subtype:            r.subtype || '',
                practice_type:      r.practice_type || 'A',
                prompt_kr:          r.prompt_kr,
                target_en:          r.target_en,
                cloze_target:       r.cloze_target || '',
                expected_phrases:   r.expected_phrases || '',
                max_latency_ms:     r.max_latency_ms || 2000,
                pattern_type:       r.pattern_type || '',
                hint_guide:         r.hint_guide || '',
                notes:              r.notes || '',
                // ── 자동 매칭 질문 정보 ──
                matched_question_id:   match?.primary_question_id   || '',
                matched_question_text: match?.primary_question_text  || '',
                match_confidence:      match?.confidence             ?? '',
                review_needed:         match?.review_needed          ? 'TRUE' : 'FALSE',
                match_source:          match?.source                 || 'not_matched',
            };
        });

        await intakeSheet.addRows(sheetRows);

        // 검토 필요 항목 카운트
        const reviewCount = matchResults.filter(m => m?.review_needed).length;
        const matchedCount = matchResults.filter(m => m !== null).length;

        return NextResponse.json({
            success: true,
            count: sheetRows.length,
            matched: matchedCount,
            review_needed: reviewCount,
        });

    } catch (e: any) {
        console.error('Intake Append Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
