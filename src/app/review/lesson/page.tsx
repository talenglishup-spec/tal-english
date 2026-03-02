'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './LessonReview.module.css';

interface LessonProgress {
    lesson_id: string;
    lesson_no: number;
    lesson_title_ko: string;
    lesson_type: string;
    lesson_date: string;
    progress: { done_count: number; total_count: number };
    last_attempt_at: string | null;
}

export default function ReviewLessonListPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [lessons, setLessons] = useState<LessonProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        if (!user) return;
        async function fetchLessons() {
            setLoading(true);
            try {
                const res = await fetch(`/api/review/lessons?playerId=${user?.id}`);
                const data = await res.json();
                if (data.success) {
                    setLessons(data.lessons);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchLessons();
    }, [user]);

    if (!user) return null;

    const filteredLessons = lessons.filter(l => filterType === 'all' || l.lesson_type === filterType);

    const getTimeAgo = (dateStr: string | null) => {
        if (!dateStr) return 'Not Attempted';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Not Attempted';
            const diffMs = Date.now() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            return `${Math.floor(diffDays / 30)} months ago`;
        } catch {
            return '';
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.title}>Review by Lesson</div>
                <button onClick={() => router.push('/home')} className={styles.homeBtn}>🏠 Home</button>
            </header>

            <div className={styles.content}>
                <div className={styles.filters}>
                    <button className={`${styles.filterBtn} ${filterType === 'all' ? styles.activeFilter : ''}`} onClick={() => setFilterType('all')}>All</button>
                    <button className={`${styles.filterBtn} ${filterType === 'onpitch' ? styles.activeFilter : ''}`} onClick={() => setFilterType('onpitch')}>On-Pitch</button>
                    <button className={`${styles.filterBtn} ${filterType === 'practice' ? styles.activeFilter : ''}`} onClick={() => setFilterType('practice')}>Practice</button>
                    <button className={`${styles.filterBtn} ${filterType === 'build' ? styles.activeFilter : ''}`} onClick={() => setFilterType('build')}>Build</button>
                    <button className={`${styles.filterBtn} ${filterType === 'interview' ? styles.activeFilter : ''}`} onClick={() => setFilterType('interview')}>Interview</button>
                </div>

                {loading ? (
                    <div className={styles.loading}>Loading lessons...</div>
                ) : filteredLessons.length > 0 ? (
                    <div className={styles.lessonList}>
                        {filteredLessons.map(lesson => {
                            const progPct = lesson.progress.total_count > 0
                                ? Math.round((lesson.progress.done_count / lesson.progress.total_count) * 100)
                                : 0;

                            return (
                                <div key={lesson.lesson_id} className={styles.lessonCard} onClick={() => router.push(`/review/lesson/${lesson.lesson_id}`)}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.lessonTypeBadge}>{lesson.lesson_type?.toUpperCase() || 'MIXED'}</span>
                                        <span className={styles.lessonDate}>{lesson.lesson_date}</span>
                                    </div>
                                    <h3>L{lesson.lesson_no}: {lesson.lesson_title_ko || `Lesson ${lesson.lesson_no}`}</h3>

                                    <div className={styles.progressWrap}>
                                        <div className={styles.progressMeta}>
                                            <span>{progPct}% Mastery</span>
                                            <span>{lesson.progress.done_count} / {lesson.progress.total_count}</span>
                                        </div>
                                        <div className={styles.progressBar}>
                                            <div className={styles.progressFill} style={{ width: `${progPct}%` }} />
                                        </div>
                                    </div>

                                    <div className={styles.lastAttempt}>
                                        🕒 {getTimeAgo(lesson.last_attempt_at)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.empty}>No lessons found matching this filter.</div>
                )}
            </div>
        </div>
    );
}
