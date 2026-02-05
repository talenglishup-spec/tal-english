'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './TeacherPage.module.css';

interface Attempt {
    player_id: string;
    player_name: string;
    date_time: string;
    ai_score: number;
    coach_score?: string;
    item_id: string;
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
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'teacher')) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (user?.role === 'teacher') {
            fetch('/api/teacher/attempts')
                .then(res => res.json())
                .then(data => {
                    const attempts: Attempt[] = data.attempts;
                    const summaryMap = new Map<string, PlayerSummary>();

                    // Aggregate attempts by player
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
                            p.name = pname; // Update name to latest used
                        }
                        if (a.ai_score) {
                            // Running sum for avg (will divide later)
                            p.avgAiScore += a.ai_score;
                        }
                        if (!a.coach_score) {
                            p.ungradedCount += 1;
                        }
                    });

                    // Finalize calculations
                    const summaryList = Array.from(summaryMap.values()).map(p => ({
                        ...p,
                        avgAiScore: p.totalAttempts > 0 ? Math.round(p.avgAiScore / p.totalAttempts) : 0,
                        lastActive: new Date(p.lastActive).toLocaleDateString()
                    }));

                    setPlayers(summaryList.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()));
                    setLoadingData(false);
                })
                .catch(err => console.error(err));
        }
    }, [user]);

    if (isLoading || loadingData) return <div style={{ padding: '2rem' }}>Loading Dashboard...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Teacher Dashboard 👨‍🏫</h1>
                <p>Overview of all players</p>
            </header>

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
