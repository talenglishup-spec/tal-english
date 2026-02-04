'use client';

import React, { useState, useEffect } from 'react';
import styles from './ChallengePage.module.css';

export default function ChallengePage() {
    const [stats, setStats] = useState<{ streak: number; activeDates: string[] }>({ streak: 0, activeDates: [] });

    useEffect(() => {
        fetch('/api/user/stats')
            .then(res => res.json())
            .then(data => setStats(data));
    }, []);

    // Generate Weekly Calendar (Sun-Sat)
    const days = ['일', '월', '화', '수', '목', '금', '토']; // Sun-Sat in Korean
    const today = new Date();

    // Get start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const isToday = (d: Date) => d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Challenge</h1>
                <div className={styles.streakBadge}>
                    🔥 {stats.streak} Days
                </div>
            </header>

            <div className={styles.card}>
                <h2 className={styles.cardTitle}>{stats.streak}일 차</h2>
                <p className={styles.cardSubtitle}>Practice makes perfect!</p>

                <div className={styles.calendarGrid}>
                    {days.map((day, i) => (
                        <div key={day} className={styles.dayLabel}>{day}</div>
                    ))}
                    {weekDates.map((date, i) => {
                        const dateStr = formatDate(date);
                        const isActive = stats.activeDates.includes(dateStr);
                        const isCurrentDay = isToday(date);

                        return (
                            <div key={i} className={styles.dayCell}>
                                <div className={`${styles.statusCircle} ${isActive ? styles.active : ''} ${isCurrentDay ? styles.today : ''}`}>
                                    {isActive ? '✓' : (isCurrentDay ? 'Today' : '')}
                                </div>
                                {!isActive && !isCurrentDay && <div className={styles.emptyCross}>✕</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Monthly View Placeholder or List */}
            <div className={styles.historySection}>
                <h3>Previous Activity</h3>
                <div className={styles.heatMap}>
                    {/* Simple visualization of last 30 days? */}
                    <p style={{ color: '#999', fontSize: '0.9rem' }}>Check back later for monthly view updates!</p>
                </div>
            </div>
        </div>
    );
}
