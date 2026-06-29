'use client';

import React, { useState, useEffect } from 'react';
import styles from './RecordPage.module.css';

import { useAuth } from '@/context/AuthContext';

import CoachRecordDashboard from '@/components/CoachRecordDashboard';

export default function RecordPage() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<{ streak: number; activeDates: string[] }>({ streak: 0, activeDates: [] });
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        if (user?.role !== 'teacher') {
            fetch('/api/user/stats')
                .then(res => res.json())
                .then(data => setStats(data));
        }
    }, [user]);

    const getWeekLabel = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const month = startOfWeek.getMonth() + 1;

        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const offset = firstDayOfMonth.getDay();
        const weekNum = Math.ceil((date.getDate() + offset) / 7);

        return `${month}월 ${weekNum}주차 (${startOfWeek.getMonth() + 1}.${startOfWeek.getDate()} ~ ${endOfWeek.getMonth() + 1}.${endOfWeek.getDate()})`;
    };

    const generateWeeklyDates = (baseDate: Date) => {
        const startOfWeek = new Date(baseDate);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());

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

        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

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
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const toggleView = () => {
        setViewMode(prev => prev === 'weekly' ? 'monthly' : 'weekly');
    };

    const daysLabel = ['일', '월', '화', '수', '목', '금', '토'];

    let gridDates: (Date | null)[] = [];
    if (viewMode === 'weekly') {
        gridDates = generateWeeklyDates(currentDate);
    } else {
        gridDates = generateMonthlyDates(currentDate);
    }

    const weekLabel = getWeekLabel(currentDate);
    const monthLabel = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

    if (user?.role === 'teacher') {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <h1>Coach Analysis</h1>
                    <button onClick={logout} className={styles.logoutBtn}>🚪</button>
                </header>
                <CoachRecordDashboard />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 style={{ margin: 0 }}>Record</h1>
                    <span className={styles.dateLabel}>
                        {viewMode === 'weekly' ? weekLabel : monthLabel}
                    </span>
                </div>

                <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                    🚪
                </button>
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
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
