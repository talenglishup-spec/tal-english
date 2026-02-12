'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './CoachRecordDashboard.module.css';

interface Player {
    player_id: string;
    player_name: string;
}

interface Lesson {
    lesson_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
}

interface Attempt {
    attempt_id: string;
    date_time: string;
    item_id: string;
    situation: string;
    ai_score: number;
    coach_feedback?: string;
    stt_text: string;
    target_en: string;
    measurement_type?: 'baseline' | 'immediate_after' | 'after_7d' | 'after_30d';
}

interface ItemCoverage {
    itemId: string;
    title: string;
    attemptsCount: number;
    passCount: number; // core pass? > 80?
    avgScore: number;
}

export default function CoachRecordDashboard() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

    const [lessonAttempts, setLessonAttempts] = useState<Attempt[]>([]);
    const [lessonItems, setLessonItems] = useState<any[]>([]); // Need to know which items are in the lesson

    const [loading, setLoading] = useState(false);

    // 1. Fetch Players
    useEffect(() => {
        fetch('/api/teacher/players')
            .then(res => res.json())
            .then(data => {
                if (data.players) {
                    setPlayers(data.players);
                    if (data.players.length > 0) {
                        setSelectedPlayerId(data.players[0].player_id);
                    }
                }
            });
    }, []);

    // 2. Fetch Lessons for Selected Player
    useEffect(() => {
        if (!selectedPlayerId) return;

        async function loadLessons() {
            setLoading(true);
            try {
                const res = await fetch(`/api/train/lessons?playerId=${selectedPlayerId}`);
                const data = await res.json();
                if (data.lessons) {
                    setLessons(data.lessons);
                    // Select most recent lesson by default? Or none?
                    // User Request: "Default: Most recently active..."
                    if (data.lessons.length > 0) {
                        // setSelectedLessonId(data.lessons[0].lesson_id);
                        // Let's not auto-select to keep list clean, or auto-select top one.
                        // Prompt says: "Selecting a lesson opens a structured report." 
                        // Implies list first. But "Most recently active player selected."
                        // Let's just list lessons.
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadLessons();
    }, [selectedPlayerId]);

    // 3. Fetch Data for Selected Lesson
    useEffect(() => {
        if (!selectedLessonId || !selectedPlayerId) return;

        async function loadReportData() {
            setLoading(true);
            try {
                // We need attempts for this player & lesson items.
                // Current API: /api/teacher/attempts (ALL) -> heavy.
                // Let's assume we fetch all attempts for player (maybe filtered)
                // MVP: Fetch ALL attempts and filter by lesson items client side.
                // Better: Create API that accepts lessonId.
                // Since `api/teacher/attempts` returns ALL, let's use it and filter.

                const [attemptsRes, itemsRes] = await Promise.all([
                    fetch('/api/teacher/attempts'), // Optimally: ?playerId=...
                    fetch(`/api/train/items?lessonId=${selectedLessonId}`) // Get items for this lesson
                ]);

                const attemptsData = await attemptsRes.json();
                const itemsData = await itemsRes.json();

                if (itemsData.items) setLessonItems(itemsData.items);

                if (attemptsData.attempts) {
                    const allAttempts = attemptsData.attempts as Attempt[];

                    // Filter attempts:
                    // 1. Must match selected player
                    // 2. Must be for an item in this lesson
                    const relevantItemIds = new Set((itemsData.items || []).map((i: any) => i.id));

                    const filtered = allAttempts.filter(a =>
                        // a.player_id === selectedPlayerId && // "Attempts are grouped by... Only attempts whose item_id belongs to selected lesson"
                        // Actually, if same item is in multiple lessons, do we include all attempts?
                        // "Attempts are NEVER used to infer lesson membership."
                        // "Only attempts whose item_id belongs to the selected lesson are included."
                        // And presumably only for this player.
                        relevantItemIds.has(a.item_id)
                        // Should we check player_id? The dashboard top level selects a player. 
                        // So yes, strictly this player's attempts on these items.
                        // Wait, api/teacher/attempts might not return player_id if not in interface?
                        // Let's assume it does. It returns AttemptRow which has player_id.
                    );

                    // Further filter by player? 
                    // The attempt row has player_id.
                    const playerAttempts = filtered.filter((a: any) => a.player_id === selectedPlayerId);

                    setLessonAttempts(playerAttempts);
                }

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadReportData();
    }, [selectedLessonId, selectedPlayerId]);

    // Analysis Logic
    const stats = useMemo(() => {
        if (!lessonItems.length) return null;

        let totalBaseline = 0;
        let totalAfter = 0;
        let baselineCount = 0;
        let afterCount = 0;

        const itemDetailStats = lessonItems.map(item => {
            const attempts = lessonAttempts
                .filter(a => a.item_id === item.id)
                .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

            if (attempts.length === 0) return { itemId: item.id, title: item.situation, baselineScore: null, afterScore: null };

            // Determine Baseline vs After
            // Logic: If 'measurement_type' exists, use it. 
            // Else: First attempt = Baseline, Last attempt (if > 1) = After.

            let baseline = attempts.find(a => a.measurement_type === 'baseline');
            let after = attempts.find(a => a.measurement_type === 'immediate_after');

            if (!baseline && attempts.length > 0) baseline = attempts[0]; // Fallback
            if (!after && attempts.length > 1) after = attempts[attempts.length - 1]; // Fallback

            const bScore = baseline ? baseline.ai_score : null;
            const aScore = after ? after.ai_score : (baseline ? baseline.ai_score : null); // If only 1 attempt, progress is 0 or same?

            if (bScore !== null) { totalBaseline += bScore; baselineCount++; }
            if (aScore !== null) { totalAfter += aScore; afterCount++; }

            return {
                itemId: item.id,
                title: item.situation,
                baselineScore: bScore,
                afterScore: aScore
            };
        });

        const avgBaseline = baselineCount > 0 ? Math.round(totalBaseline / baselineCount) : 0;
        const avgAfter = afterCount > 0 ? Math.round(totalAfter / afterCount) : 0;
        const overallImprovement = avgAfter - avgBaseline;

        return {
            itemDetailStats,
            avgBaseline,
            avgAfter,
            overallImprovement,
            totalAttempts: lessonAttempts.length
        };

    }, [lessonAttempts, lessonItems]);

    const selectedLesson = lessons.find(l => l.lesson_id === selectedLessonId);

    return (
        <div className={styles.container}>
            {/* 1. Player Selector */}
            <div className={styles.selectorRow}>
                <label>Analyzed Player:</label>
                <select
                    value={selectedPlayerId}
                    onChange={(e) => {
                        setSelectedPlayerId(e.target.value);
                        setSelectedLessonId(null);
                    }}
                    className={styles.select}
                >
                    {players.map(p => (
                        <option key={p.player_id} value={p.player_id}>
                            {p.player_id} – {p.player_name}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.layout}>
                {/* 2. Lesson List (Sidebar/Top) */}
                <div className={styles.lessonList}>
                    <h3>Lesson Reports</h3>
                    {lessons.length === 0 && <p className={styles.empty}>No lessons assigned.</p>}
                    {lessons.map(lesson => (
                        <div
                            key={lesson.lesson_id}
                            className={`${styles.lessonItem} ${selectedLessonId === lesson.lesson_id ? styles.selected : ''}`}
                            onClick={() => setSelectedLessonId(lesson.lesson_id)}
                        >
                            <div className={styles.lessonHeader}>
                                <strong>Lesson {lesson.lesson_no}</strong>
                                <span className={styles.date}>{lesson.lesson_date}</span>
                            </div>
                            <div className={styles.note}>{lesson.note}</div>
                        </div>
                    ))}
                </div>

                {/* 3. Report View */}
                <div className={styles.reportArea}>
                    {!selectedLessonId ? (
                        <div className={styles.placeholder}>
                            Select a lesson to view analysis.
                        </div>
                    ) : (
                        <div className={styles.report} id="report-print-area">
                            <div className={styles.reportHeader}>
                                <div className={styles.headerTitleRow}>
                                    <h2>Lesson {selectedLesson?.lesson_no} Analysis Report</h2>
                                    <div className={styles.exportActions}>
                                        <button onClick={() => window.print()} className={styles.exportBtn}>Export PDF</button>
                                        <button onClick={() => {
                                            // CSV Export Logic
                                            const headers = ['ItemID', 'Title', 'Baseline Score', 'After Score', 'Improvement'];
                                            const rows = stats?.itemDetailStats.map(s => [
                                                s.itemId,
                                                s.title,
                                                s.baselineScore || 0,
                                                s.afterScore || 0,
                                                (s.afterScore || 0) - (s.baselineScore || 0)
                                            ]);
                                            const csvContent = "data:text/csv;charset=utf-8,"
                                                + [headers.join(','), ...(rows || []).map(r => r.join(','))].join('\n');
                                            const encodedUri = encodeURI(csvContent);
                                            const link = document.createElement("a");
                                            link.setAttribute("href", encodedUri);
                                            link.setAttribute("download", `lesson_${selectedLesson?.lesson_no}_report.csv`);
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }} className={styles.exportBtn}>Export CSV</button>
                                    </div>
                                </div>
                                <div className={styles.meta}>
                                    <span>Player: {players.find(p => p.player_id === selectedPlayerId)?.player_name}</span>
                                    <span>•</span>
                                    <span>Date: {selectedLesson?.lesson_date}</span>
                                </div>
                            </div>

                            {/* Section: Executive Summary (Business Rpt) */}
                            <div className={styles.section}>
                                <h3>Coach Executive Summary</h3>
                                <div className={styles.analysisBox}>
                                    <p className={styles.summaryText}>
                                        "{players.find(p => p.player_id === selectedPlayerId)?.player_name} demonstrated
                                        {stats?.overallImprovement && stats.overallImprovement > 0 ? ' solid progress' : ' consistent effort'} in Lesson {selectedLesson?.lesson_no}.
                                        Primary focus on {lessonItems[0]?.category || 'communication'} shows
                                        {stats?.overallImprovement && stats.overallImprovement > 10 ? ' significant' : ' steady'} improvement
                                        ({stats?.avgBaseline || 0} → {stats?.avgAfter || 0})."
                                    </p>
                                </div>
                            </div>

                            {/* Section: Before / After Comparison */}
                            <div className={styles.section}>
                                <h3>Before & After Comparison</h3>
                                <div className={styles.comparisonGrid}>
                                    <div className={styles.statCard}>
                                        <div className={styles.statLabel}>Baseline Avg</div>
                                        <div className={styles.statValue}>{stats?.avgBaseline || '-'}</div>
                                    </div>
                                    <div className={styles.arrow}>→</div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statLabel}>Immediate After</div>
                                        <div className={`${styles.statValue} ${styles.improved}`}>{stats?.avgAfter || '-'}</div>
                                    </div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statLabel}>Improvement</div>
                                        <div className={styles.statDifference}>
                                            +{((stats?.avgAfter || 0) - (stats?.avgBaseline || 0)).toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Item Detail Table */}
                            <div className={styles.section}>
                                <h3>Detailed Item Performance</h3>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Item Title</th>
                                            <th>Baseline</th>
                                            <th>After</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats?.itemDetailStats.map(stat => (
                                            <tr key={stat.itemId}>
                                                <td>{stat.title}</td>
                                                <td>{stat.baselineScore ? stat.baselineScore.toFixed(0) : '-'}</td>
                                                <td>{stat.afterScore ? stat.afterScore.toFixed(0) : '-'}</td>
                                                <td>
                                                    {stat.afterScore && stat.baselineScore && stat.afterScore > stat.baselineScore && (
                                                        <span className={styles.badgeSuccess}>Improved</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
