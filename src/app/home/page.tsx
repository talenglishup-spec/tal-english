'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './HomePage.module.css';

interface Lesson {
    lesson_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
}

export default function HomePage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [latestLesson, setLatestLesson] = useState<Lesson | null>(null);
    const [itemCount, setItemCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            try {
                // 1. Get Lessons
                const lessonsRes = await fetch(`/api/train/lessons?playerId=${user.id}`);
                const lessonsData = await lessonsRes.json();

                if (lessonsData.lessons && lessonsData.lessons.length > 0) {
                    const topLesson = lessonsData.lessons[0]; // Assuming sorted desc
                    setLatestLesson(topLesson);

                    // 2. Get Items count for this lesson
                    const itemsRes = await fetch(`/api/train/items?lessonId=${topLesson.lesson_id}`);
                    const itemsData = await itemsRes.json();
                    if (itemsData.items) {
                        setItemCount(itemsData.items.length);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        if (user) {
            fetchData();
        }
    }, [user]);

    const handleStartPractice = () => {
        if (latestLesson) {
            router.push(`/practice?lessonId=${latestLesson.lesson_id}`);
        } else {
            router.push('/practice');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <h2 className={styles.appLabel}>TAL Coach</h2>
                    <h1 className={styles.mission}>Take A Leap</h1>
                </div>
                <button onClick={logout} className={styles.logoutBtn}>🚪</button>
            </header>

            <div className={styles.content}>
                <section className={styles.focusSection}>
                    <h3 className={styles.sectionTitle}>Today's Focus</h3>

                    {loading ? (
                        <div className={styles.cardSkeleton}>Loading...</div>
                    ) : latestLesson ? (
                        <div className={styles.focusCard}>
                            <div className={styles.cardHeader}>
                                <span className={styles.lessonBadges}>New</span>
                                <span className={styles.date}>{latestLesson.lesson_date}</span>
                            </div>
                            <h2 className={styles.lessonTitle}>Lesson {latestLesson.lesson_no}</h2>
                            <p className={styles.lessonNote}>{latestLesson.note}</p>

                            <div className={styles.stats}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{itemCount}</span>
                                    <span className={styles.statLabel}>items available</span>
                                </div>
                            </div>

                            <button onClick={handleStartPractice} className={styles.primaryBtn}>
                                Start Practice
                            </button>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <p>No lessons assigned yet.</p>
                            <button onClick={() => router.push('/practice')} className={styles.secondaryBtn}>
                                Go to Practice
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
