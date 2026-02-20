'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './TeacherPage.module.css';

interface Attempt {
    player_id: string;
    player_name: string;
    date_time: string;
    ai_score: number;
    coach_score?: string;
    item_id: string;
    session_mode?: 'challenge' | 'practice';
    time_to_first_response_ms?: number;
    translation_toggle_count?: number;
    answer_revealed?: boolean;
    duration_sec?: number;
    model_play_count?: number;
    question_play_count?: number;
}

interface PlayerSummary {
    id: string;
    name: string;
    lastActive: string;
    totalAttempts: number;
    avgAiScore: number;
    ungradedCount: number;
}

export default function TeacherPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState<PlayerSummary[]>([]);

    // Global KPIs
    const [kpi, setKpi] = useState({
        challengeAttempts: 0,
        avgResponseSpeed: 0,
        challengeAnswerRevealedRate: 0,
        challengeTranslationRate: 0,
        practiceAttempts: 0,
        avgModelPlay: 0,
        avgDurationSec: 0,
        practiceTranslationToggleAvg: 0
    });

    const [alerts, setAlerts] = useState<{ msg: string, type: 'warning' | 'info' }[]>([]);

    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!isLoading && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (user?.role === 'teacher' || user?.role === 'admin') {
            fetch('/api/teacher/attempts')
                .then(res => res.json())
                .then(data => {
                    const attempts: Attempt[] = data.attempts;
                    const summaryMap = new Map<string, PlayerSummary>();

                    // Aggregating KPIs across ALL players
                    let cCount = 0; let cResponseSum = 0; let cRevealCount = 0; let cTranslationCount = 0;
                    let pCount = 0; let pModelSum = 0; let pDurationSum = 0; let pTranslationSum = 0;

                    let totalUngraded = 0;

                    attempts.forEach(a => {
                        const pid = a.player_id || 'anon';
                        const pname = a.player_name || 'Anonymous';

                        if (!summaryMap.has(pid)) {
                            summaryMap.set(pid, {
                                id: pid,
                                name: pname,
                                lastActive: a.date_time,
                                totalAttempts: 0,
                                avgAiScore: 0,
                                ungradedCount: 0
                            });
                        }

                        const p = summaryMap.get(pid)!;
                        p.totalAttempts += 1;
                        if (new Date(a.date_time) > new Date(p.lastActive)) {
                            p.lastActive = a.date_time;
                            p.name = pname;
                        }
                        if (a.ai_score) p.avgAiScore += a.ai_score;
                        if (!a.coach_score) {
                            p.ungradedCount += 1;
                            totalUngraded += 1;
                        }

                        if (a.session_mode === 'challenge') {
                            cCount++;
                            cResponseSum += (a.time_to_first_response_ms || 0);
                            if (a.answer_revealed) cRevealCount++;
                            if (a.translation_toggle_count && a.translation_toggle_count > 0) cTranslationCount++;
                        } else {
                            pCount++;
                            pModelSum += (a.model_play_count || 0);
                            pDurationSum += (a.duration_sec || 0);
                            pTranslationSum += (a.translation_toggle_count || 0);
                        }
                    });

                    // Finalize calculations
                    const summaryList = Array.from(summaryMap.values()).map(p => ({
                        ...p,
                        avgAiScore: p.totalAttempts > 0 ? Math.round(p.avgAiScore / p.totalAttempts) : 0,
                        lastActive: new Date(p.lastActive).toLocaleDateString()
                    }));

                    setPlayers(summaryList.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()));

                    setKpi({
                        challengeAttempts: cCount,
                        avgResponseSpeed: cCount > 0 ? Math.round(cResponseSum / cCount) : 0,
                        challengeAnswerRevealedRate: cCount > 0 ? Math.round((cRevealCount / cCount) * 100) : 0,
                        challengeTranslationRate: cCount > 0 ? Math.round((cTranslationCount / cCount) * 100) : 0,
                        practiceAttempts: pCount,
                        avgModelPlay: pCount > 0 ? Number((pModelSum / pCount).toFixed(1)) : 0,
                        avgDurationSec: pCount > 0 ? Math.round(pDurationSum / pCount) : 0,
                        practiceTranslationToggleAvg: pCount > 0 ? Number((pTranslationSum / pCount).toFixed(1)) : 0
                    });

                    const newAlerts = [];
                    if (totalUngraded > 0) newAlerts.push({ msg: `${totalUngraded} attempts require Coach Grading`, type: 'warning' as const });
                    if (cCount > 0 && cResponseSum / cCount > 3000) newAlerts.push({ msg: 'Average Challenge response is over 3 seconds (Hesitation limit reached)', type: 'warning' as const });
                    setAlerts(newAlerts);

                    setLoadingData(false);
                })
                .catch(err => console.error(err));
        }
    }, [user]);

    if (isLoading || loadingData) return <div style={{ padding: '2rem' }}>Loading Dashboard...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Teacher Dashboard 👨‍🏫</h1>
                    <p>Overview of all players</p>
                </div>
                <button
                    onClick={() => router.push('/teacher/materials')}
                    style={{
                        background: '#0070f3', color: 'white', padding: '10px 16px', borderRadius: '8px',
                        border: 'none', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    📚 Manage Materials
                </button>
            </header>

            <div className={styles.kpiDashboard}>
                <div className={styles.kpiGroup}>
                    <h3 style={{ color: '#f87171' }}>🔴 Challenge KPI (실전 적응도)</h3>
                    <div className={styles.kpiCards}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.challengeAttempts}</div>
                            <div className={styles.kpiLabel}>Attempts</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.avgResponseSpeed}ms</div>
                            <div className={styles.kpiLabel}>Avg Response</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.challengeTranslationRate}%</div>
                            <div className={styles.kpiLabel}>Used Translator</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.challengeAnswerRevealedRate}%</div>
                            <div className={styles.kpiLabel}>Revealed Answer</div>
                        </div>
                    </div>
                </div>

                <div className={styles.kpiGroup}>
                    <h3 style={{ color: '#60a5fa' }}>🔵 Practice KPI (훈련량/습관)</h3>
                    <div className={styles.kpiCards}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.practiceAttempts}</div>
                            <div className={styles.kpiLabel}>Attempts</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.avgModelPlay}</div>
                            <div className={styles.kpiLabel}>Avg Model Plays</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.practiceTranslationToggleAvg}</div>
                            <div className={styles.kpiLabel}>Avg Translation Toggles</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiVal}>{kpi.avgDurationSec}s</div>
                            <div className={styles.kpiLabel}>Avg Record Time</div>
                        </div>
                    </div>
                </div>
            </div>

            {alerts.length > 0 && (
                <div className={styles.alertsContainer}>
                    {alerts.map((a, i) => (
                        <div key={i} className={styles.alertBox}>
                            ⚠️ {a.msg}
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.cardContainer}>
                <Link href="/teacher/lessons" className={styles.card}>
                    <div className={styles.icon}>📅</div>
                    <h2>Lesson Manager</h2>
                    <p>Assign lessons to players</p>
                </Link>
                <Link href="/teacher/items" className={styles.card}>
                    <div className={styles.icon}>🔊</div>
                    <h2>Items & Audio</h2>
                    <p>Manage Questions</p>
                </Link>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Last Active</th>
                            <th>Attempts</th>
                            <th>Avg AI Score</th>
                            <th>Ungraded</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map(p => (
                            <tr key={p.id}>
                                <td className={styles.playerCell}>
                                    <div className={styles.playerName}>{p.name}</div>
                                    <div className={styles.playerId}>{p.id}</div>
                                </td>
                                <td>{p.lastActive}</td>
                                <td>{p.totalAttempts}</td>
                                <td>
                                    <span className={p.avgAiScore >= 80 ? styles.scoreHigh : p.avgAiScore >= 60 ? styles.scoreMid : styles.scoreLow}>
                                        {p.avgAiScore}
                                    </span>
                                </td>
                                <td>
                                    {p.ungradedCount > 0 ? (
                                        <span className={styles.badgeWarning}>{p.ungradedCount} Need Grading</span>
                                    ) : (
                                        <span className={styles.badgeSuccess}>All Done</span>
                                    )}
                                </td>
                                <td>
                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => router.push(`/teacher/player/${p.id}`)}
                                    >
                                        Detail ▶
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
