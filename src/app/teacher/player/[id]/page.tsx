'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from '../../TeacherPage.module.css'; // Reuse styles

interface Attempt {
    attempt_id: string;
    player_id: string;
    date_time: string;
    situation: string;
    target_en: string;
    stt_text: string;
    ai_score: number;
    coach_score?: string;
    coach_feedback?: string;
    audio_url: string;
    session_mode?: 'challenge' | 'practice';
    time_to_first_response_ms?: number;
    translation_toggle_count?: number;
    answer_revealed?: boolean;
    duration_sec?: number;
    question_play_count?: number;
    model_play_count?: number;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    // Unwrap params using React.use()
    const { id } = use(params);

    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const [snapshot, setSnapshot] = useState({
        readinessScore: 0,
        practiceRepeats: 0,
        practiceTranslation: 0,
        practiceReveals: 0,
        weakSpots: [] as string[]
    });

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editScore, setEditScore] = useState('');
    const [editFeedback, setEditFeedback] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'teacher')) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (id) {
            fetch(`/api/user/stats?playerId=${id}`)
            // stats API only returns summary+latest. We need FULL list.
            // Actually we can reuse /api/teacher/attempts but filter? or better specific endpoint.
            // let's use the big endpoint and filter client side for MVP simplicity.
            // Efficiency warning: creates over-fetching but simplest to code now.

            fetch('/api/teacher/attempts')
                .then(res => res.json())
                .then(data => {
                    const all: Attempt[] = data.attempts;
                    const filtered = all.filter(a => a.player_id === id);
                    filtered.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
                    setAttempts(filtered);

                    // Compute Snapshot & Weak Spots
                    let cCount = 0;
                    let pCount = 0;
                    let pModel = 0;
                    let pTranslation = 0;
                    let pReveals = 0;

                    let cResponseSum = 0;
                    let cIndepCount = 0;
                    let cNoTranslationCount = 0;
                    let cNoListenCount = 0;

                    let isHesitation = false;
                    let isTranslationDependent = false;
                    let isShortOutput = false;

                    let cResponseSumForSpot = 0;
                    let cQuestionPlayForSpot = 0;
                    let tToggleCountForSpot = 0;
                    let aRevealCountForSpot = 0;
                    let durationSumForSpot = 0;

                    filtered.forEach(a => {
                        if (a.session_mode === 'challenge') {
                            cCount++;
                            const rTime = a.time_to_first_response_ms || 0;
                            const tCount = a.translation_toggle_count || 0;
                            const qPlay = a.question_play_count || 0;
                            const dur = a.duration_sec || 0;

                            // Readiness metrics
                            cResponseSum += rTime;
                            if (!a.answer_revealed) cIndepCount++;
                            if (tCount === 0) cNoTranslationCount++;
                            if (qPlay <= 1) cNoListenCount++;

                            // Spot metrics
                            cResponseSumForSpot += rTime;
                            cQuestionPlayForSpot += qPlay;
                            tToggleCountForSpot += tCount;
                            if (a.answer_revealed) aRevealCountForSpot++;
                            durationSumForSpot += dur;
                        } else {
                            pCount++;
                            pModel += (a.model_play_count || 0);
                            pTranslation += (a.translation_toggle_count || 0);
                            if (a.answer_revealed) pReveals++;
                        }
                    });

                    // Weak spots thresholds
                    if (cCount > 0) {
                        const avgResp = cResponseSumForSpot / cCount;
                        const avgQPlay = cQuestionPlayForSpot / cCount;
                        if (avgResp > 3000 || avgQPlay > 1.5) isHesitation = true;

                        const translationRate = tToggleCountForSpot / cCount;
                        const revealRate = aRevealCountForSpot / cCount;
                        if (translationRate > 0.5 || revealRate > 0.3) isTranslationDependent = true;

                        const avgDur = durationSumForSpot / cCount;
                        if (avgDur > 0 && avgDur < 2) isShortOutput = true;
                    }

                    const weaknesses = [];
                    if (isHesitation) weaknesses.push("Hesitation (망설임형)");
                    if (isTranslationDependent) weaknesses.push("Translation Dependent (번역 의존형)");
                    if (isShortOutput) weaknesses.push("Short Output (단답형)");

                    // CRI Calculation (0 ~ 100)
                    let readiness = 0;
                    if (cCount > 0) {
                        const scoreResp = Math.max(0, 100 - (cResponseSum / cCount / 100)); // 0ms=100, 10초=0
                        const scoreIndep = (cIndepCount / cCount) * 100;
                        const scoreNoTrans = (cNoTranslationCount / cCount) * 100;
                        const scoreNoListen = (cNoListenCount / cCount) * 100;
                        readiness = Math.round((scoreResp * 0.4) + (scoreIndep * 0.2) + (scoreNoTrans * 0.2) + (scoreNoListen * 0.2));
                    }

                    setSnapshot({
                        readinessScore: readiness,
                        practiceRepeats: pCount > 0 ? Number((pModel / pCount).toFixed(1)) : 0,
                        practiceTranslation: pCount > 0 ? Number((pTranslation / pCount).toFixed(1)) : 0,
                        practiceReveals: pCount > 0 ? Math.round((pReveals / pCount) * 100) : 0,
                        weakSpots: weaknesses
                    });

                    setLoadingData(false);
                });
        }
    }, [id]);

    const startEdit = (a: Attempt) => {
        setEditingId(a.attempt_id);
        setEditScore(a.coach_score || '');
        setEditFeedback(a.coach_feedback || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            const res = await fetch('/api/teacher/update-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attemptId: editingId,
                    coach_score: editScore,
                    coach_feedback: editFeedback
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update local list
                setAttempts(prev => prev.map(a =>
                    a.attempt_id === editingId
                        ? { ...a, coach_score: editScore, coach_feedback: editFeedback }
                        : a
                ));
                setEditingId(null);
            } else {
                alert('Failed to save');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading || loadingData) return <div style={{ padding: '2rem' }}>Loading Player Data...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', marginBottom: '1rem' }}
                >
                    ← Back
                </button>
                <h1>Player: {id}</h1>
            </header>

            <div className={styles.kpiDashboard} style={{ marginBottom: '2rem' }}>
                <div className={styles.kpiGroup}>
                    <h3 style={{ color: '#8b5cf6' }}>🌟 Player Snapshot</h3>
                    <div className={styles.kpiCards}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal} style={{ color: snapshot.readinessScore > 70 ? '#10b981' : '#f59e0b' }}>
                                {snapshot.readinessScore}
                            </div>
                            <div className={styles.kpiLabel}>Challenge Readiness (0-100)</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{snapshot.practiceRepeats}</div>
                            <div className={styles.kpiLabel}>Practice Repeats (Avg)</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{snapshot.practiceTranslation}</div>
                            <div className={styles.kpiLabel}>Practice Toggles (Avg)</div>
                        </div>
                    </div>
                </div>

                {snapshot.weakSpots.length > 0 && (
                    <div className={styles.kpiGroup}>
                        <h3 style={{ color: '#ef4444' }}>⚠️ Detected Weak Spots</h3>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            {snapshot.weakSpots.map(w => (
                                <div key={w} style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                                    {w}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Situation / Target</th>
                            <th>User Audio</th>
                            <th>AI Score</th>
                            <th style={{ minWidth: '200px' }}>Coach Feedback</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attempts.map(a => (
                            <tr key={a.attempt_id}>
                                <td style={{ fontSize: '0.85rem' }}>
                                    {new Date(a.date_time).toLocaleString()}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.situation}</div>
                                    <div style={{ color: '#666', fontSize: '0.8rem' }}>{a.target_en}</div>
                                    <div style={{ color: '#0070f3', fontSize: '0.8rem', marginTop: '4px' }}>Input: "{a.stt_text}"</div>
                                </td>
                                <td>
                                    {a.audio_url && (
                                        <audio controls src={a.audio_url} style={{ height: '30px', width: '200px' }} />
                                    )}
                                </td>
                                <td>
                                    <span style={{ fontWeight: 'bold' }}>{a.ai_score}</span>
                                </td>
                                <td>
                                    {editingId === a.attempt_id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                placeholder="Score (e.g. A, B, 90)"
                                                value={editScore}
                                                onChange={e => setEditScore(e.target.value)}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                            />
                                            <textarea
                                                placeholder="Feedback..."
                                                value={editFeedback}
                                                onChange={e => setEditFeedback(e.target.value)}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            {a.coach_score && (
                                                <div style={{ fontWeight: 'bold', color: '#e65100' }}>Score: {a.coach_score}</div>
                                            )}
                                            <div style={{ fontSize: '0.9rem', color: '#555' }}>{a.coach_feedback || '-'}</div>
                                        </div>
                                    )}
                                </td>
                                <td>
                                    {editingId === a.attempt_id ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={saveEdit} disabled={saving} className={styles.badgeSuccess} style={{ cursor: 'pointer', border: 'none' }}>
                                                {saving ? '...' : 'Save'}
                                            </button>
                                            <button onClick={cancelEdit} className={styles.viewBtn}>Cancel</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(a)} className={styles.viewBtn}>
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
