'use client';

import React, { useState, useEffect } from 'react';
import styles from './ChallengePage.module.css';

export default function ChallengePage() {
    const [stats, setStats] = useState<{ streak: number; activeDates: string[] }>({ streak: 0, activeDates: [] });
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
    const [currentDate, setCurrentDate] = useState(new Date()); // For navigating months if needed

    useEffect(() => {
        fetch('/api/user/stats')
            .then(res => res.json())
            .then(data => setStats(data));
    }, []);

    // --- Helper Functions ---

    const getWeekLabel = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday? or Sunday as start?
        // User example: 2/2(Sun) ~ 2/8(Sat). Let's use Sunday start.

        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay()); // Sunday

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

        const month = startOfWeek.getMonth() + 1;

        // Calculate Week Number of Month
        // Simple approx: Math.ceil(date / 7)? No.
        // Get the first date of the month
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const offset = firstDayOfMonth.getDay();
        const weekNum = Math.ceil((date.getDate() + offset) / 7);

        return `${month}월 ${weekNum}주차 (${startOfWeek.getMonth() + 1}.${startOfWeek.getDate()} ~ ${endOfWeek.getMonth() + 1}.${endOfWeek.getDate()})`;
    };

    const generateWeeklyDates = (baseDate: Date) => {
        const startOfWeek = new Date(baseDate);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(baseDate.getDate() - baseDate.getDay()); // Sunday start

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });
    };

    const generateMonthlyDates = (baseDate: Date) => {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];

        // Pad start (Sunday to 1st)
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const isToday = (d: Date | null) => {
        if (!d) return false;
        return d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    };

    const formatDate = (d: Date | null) => {
        if (!d) return '';
        // handle timezone offset issue - simple string split is safe for local dates if constructed properly, 
        // but let's be careful. toISOString uses UTC. 
        // We want Local YYYY-MM-DD for comparison with server stats (which matches local dates mostly).
        // Actually server uses ISOString YYYY-MM-DD.
        // Let's use simple manual format:
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const toggleView = () => {
        setViewMode(prev => prev === 'weekly' ? 'monthly' : 'weekly');
    };

    // --- Render Logic ---
    const daysLabel = ['일', '월', '화', '수', '목', '금', '토'];

    // Data for Grid
    let gridDates: (Date | null)[] = [];
    if (viewMode === 'weekly') {
        gridDates = generateWeeklyDates(currentDate);
    } else {
        gridDates = generateMonthlyDates(currentDate);
    }

    const weekLabel = getWeekLabel(currentDate);
    const monthLabel = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 style={{ margin: 0 }}>Challenge</h1>
                    <span className={styles.dateLabel}>
                        {viewMode === 'weekly' ? weekLabel : monthLabel}
                    </span>
                </div>

                <div className={styles.streakBadge}>
                    🔥 {stats.streak}일 연속
                </div>
            </header>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h2 className={styles.cardTitle}>{stats.streak}일 성공!</h2>
                        <p className={styles.cardSubtitle}>꾸준함이 실력을 만듭니다.</p>
                    </div>
                    <button className={styles.viewToggleBtn} onClick={toggleView}>
                        {viewMode === 'weekly' ? '월별 보기' : '주별 보기'}
                    </button>
                </div>

                <div className={styles.calendarGrid}>
                    {daysLabel.map((day) => (
                        <div key={day} className={styles.dayLabel}>{day}</div>
                    ))}

                    {gridDates.map((date, i) => {
                        if (!date) return <div key={i} className={styles.dayCell}></div>;

                        const dateStr = formatDate(date);
                        const isActive = stats.activeDates.includes(dateStr);
                        const isTodayDate = isToday(date);

                        return (
                            <div key={i} className={styles.dayCell}>
                                <div className={`${styles.statusCircle} ${isActive ? styles.active : ''} ${isTodayDate ? styles.today : ''}`}>
                                    {isActive ? '✓' : date.getDate()}
                                    {/* Show Date number if not active, check if active */}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={styles.historySection}>
                {/* <h3>나의 학습 통계</h3> */}
                {/* Could add total hours, accuracy avg etc here later */}
            </div>
        </div>
    );
}
