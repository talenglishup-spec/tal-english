'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import ExpressionLearner, { type Mode, type Expression } from './ExpressionLearner';
import styles from './ExpressionPage.module.css';

// ─── Mode display info ────────────────────────────────────────────────────────

const MODE_INFO: Record<Mode, { label: string; icon: string; desc: string; time: string }> = {
    view:      { label: '보기',        icon: '👁️',  desc: '표현 + 뜻 + 예문 읽기 + TTS 듣기', time: '2분' },
    cloze:     { label: '빈칸 채우기', icon: '✏️',  desc: '예문에서 표현 빈칸 채우기',          time: '2분' },
    speaking:  { label: '따라 말하기', icon: '🔊',  desc: 'TTS 듣고 바로 따라 말하기',          time: '2분' },
    flashcard: { label: '플래시카드',  icon: '🃏',  desc: '뜻만 보고 표현 맞히기',              time: '1분' },
};

type Phase = 'loading' | 'intro' | 'learning' | 'complete' | 'error';

// ─────────────────────────────────────────────────────────────────────────────

export default function ExpressionSessionPage() {
    const { user }   = useAuth();
    const router     = useRouter();
    const params     = useParams();
    const lessonId   = params.lesson_id as string;

    const [phase,       setPhase]       = useState<Phase>('loading');
    const [expressions, setExpressions] = useState<Expression[]>([]);
    const [mode,        setMode]        = useState<Mode>('view');
    const [errorMsg,    setErrorMsg]    = useState('');

    useEffect(() => {
        if (!user?.id || !lessonId) return;

        async function load() {
            try {
                const res  = await fetch(`/api/expressions?lessonId=${lessonId}&playerId=${user!.id}`);
                const data = await res.json();

                if (!res.ok || !data.expressions?.length) {
                    setErrorMsg('이 레슨에 등록된 표현이 없습니다.');
                    setPhase('error');
                    return;
                }

                setExpressions(data.expressions);
                setMode(data.mode ?? 'view');
                setPhase('intro');
            } catch {
                setErrorMsg('데이터를 불러오는 중 오류가 발생했습니다.');
                setPhase('error');
            }
        }

        load();
    }, [user?.id, lessonId]);

    // ── Loading ────────────────────────────────────────────────────────────
    if (phase === 'loading') {
        return <div className={styles.center}>Loading...</div>;
    }

    // ── Error ──────────────────────────────────────────────────────────────
    if (phase === 'error') {
        return (
            <div className={styles.center}>
                <p>{errorMsg}</p>
                <button className={styles.backBtn} onClick={() => router.back()}>← 돌아가기</button>
            </div>
        );
    }

    // ── Intro screen ───────────────────────────────────────────────────────
    if (phase === 'intro') {
        const info = MODE_INFO[mode];
        return (
            <div className={styles.page}>
                <button className={styles.closeBtn} onClick={() => router.back()}>✕</button>

                <div className={styles.introWrap}>
                    <p className={styles.introLabel}>오늘의 표현</p>

                    <div className={styles.pillRow}>
                        {expressions.map(e => (
                            <span key={e.expression_id} className={styles.pill}>
                                {e.expression}
                            </span>
                        ))}
                    </div>

                    <div className={styles.modeCard}>
                        <span className={styles.modeIcon}>{info.icon}</span>
                        <div>
                            <div className={styles.modeLabel}>🎯 오늘 방식: {info.label}</div>
                            <div className={styles.modeDesc}>{info.desc}</div>
                            <div className={styles.modeTime}>예상 시간: {info.time}</div>
                        </div>
                    </div>

                    <button className={styles.startBtn} onClick={() => setPhase('learning')}>
                        시작
                    </button>
                </div>
            </div>
        );
    }

    // ── Learning ───────────────────────────────────────────────────────────
    if (phase === 'learning') {
        return (
            <ExpressionLearner
                expressions={expressions}
                mode={mode}
                playerId={user!.id}
                lessonId={lessonId}
                onComplete={() => setPhase('complete')}
                onClose={() => router.back()}
            />
        );
    }

    // ── Complete ───────────────────────────────────────────────────────────
    return (
        <div className={styles.page}>
            <div className={styles.completeWrap}>
                <div className={styles.completeIcon}>🎉</div>
                <h2 className={styles.completeTitle}>오늘 표현 완료!</h2>
                <p className={styles.completeSub}>
                    {expressions.length}개 표현 · {MODE_INFO[mode].label}
                </p>
                <div className={styles.completeActions}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => router.push('/review')}
                    >
                        리뷰로 가기
                    </button>
                    <button
                        className={styles.startBtn}
                        onClick={() => router.push('/practice')}
                    >
                        연습하러 가기 →
                    </button>
                </div>
            </div>
        </div>
    );
}
