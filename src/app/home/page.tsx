'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './HomePage.module.css';

interface DashboardStats {
    streak: number;
    progressPercent: number;
    avgScore: number;
    totalAttempts: number;
    ungradedCount: number;
    latestAttempt: any;
}

export default function PlayerHomePage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        } else if (user && user.role !== 'player') {
            // Include logic to redirect teacher if they accidentally land here? 
            // Or allow teacher to see own view? Teacher doesn't have player stats usually.
            // Redirect to teacher dash.
            router.push('/teacher');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (user?.id) {
            fetch(`/api/user/stats?playerId=${user.id}`)
                .then(res => res.json())
                .then(data => setStats(data))
                .catch(err => console.error(err));
        }
    }, [user?.id]);

    if (isLoading || !user) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.greeting}>Hi, {user.name} 👋</h1>
                    <p className={styles.subtitle}>Ready for today's training?</p>
                </div>
                <button className={styles.trainButton} onClick={() => router.push('/train')}>
                    Start Training ▶
                </button>
            </header>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Total Progress</div>
                    <div className={styles.statValue}>{stats?.progressPercent || 0}%</div>
                    <div className={styles.statSub}>of curriculum</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Avg Score</div>
                    <div className={`${styles.statValue} ${styles.score}`}>{stats?.avgScore || '-'}</div>
                    <div className={styles.statSub}>Last 10 attempts</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Streak</div>
                    <div className={`${styles.statValue} ${styles.streak}`}>{stats?.streak || 0}</div>
                    <div className={styles.statSub}>days in a row</div>
                </div>
            </div>

            {/* Coach Feedback Alert */}
            {stats?.latestAttempt?.coach_feedback && (
                <div className={styles.feedbackCard}>
                    <div className={styles.feedbackHeader}>
                        <span className={styles.feedbackIcon}>💌</span> New Coach Feedback
                    </div>
                    <p className={styles.feedbackText}>
                        "{stats.latestAttempt.coach_feedback}"
                    </p>
                    <div className={styles.feedbackDate}>
                        From: {new Date(stats.latestAttempt.date_time).toLocaleDateString()}
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>Latest Attempt</h2>
                    <button className={styles.linkButton} onClick={() => router.push('/review')}>View All</button>
                </div>

                {stats?.latestAttempt ? (
                    <div className={styles.activityCard}>
                        <div className={styles.activityInfo}>
                            <h3>{stats.latestAttempt.situation}</h3>
                            <p>{stats.latestAttempt.target_en}</p>
                            <span className={styles.dateBadge}>
                                {new Date(stats.latestAttempt.date_time).toLocaleString()}
                            </span>
                        </div>
                        <div className={styles.activityScore}>
                            <div className={styles.scoreCircle}>
                                {stats.latestAttempt.ai_score}
                            </div>
                            <span className={styles.scoreLabel}>AI Score</span>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        No attempts yet. Start your first training!
                    </div>
                )}
            </div>

            <div className={styles.navLinks}>
                <button onClick={() => router.push('/challenge')} className={styles.navCard}>
                    🏆 View Challenges
                </button>
                <button onClick={() => router.push('/review')} className={styles.navCard}>
                    📝 Review History
                </button>
            </div>
        </div>
    );
}
