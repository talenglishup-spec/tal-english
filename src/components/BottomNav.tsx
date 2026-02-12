'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

export default function BottomNav() {
    const { user } = useAuth();
    const pathname = usePathname();

    // Hide if not logged in
    if (!user) return null;

    // Check active state
    const isActive = (path: string) => pathname === path || pathname?.startsWith(path);

    return (
        <nav className={styles.bottomNav}>
            <Link href="/home" className={`${styles.navItem} ${isActive('/home') ? styles.active : ''}`}>
                <div className={styles.icon}>🏠</div>
                <span className={styles.label}>홈</span>
            </Link>

            <Link href="/challenge" className={`${styles.navItem} ${isActive('/challenge') ? styles.active : ''}`}>
                <div className={styles.icon}>🏆</div>
                <span className={styles.label}>챌린지</span>
            </Link>

            <Link href="/practice" className={`${styles.navItem} ${isActive('/practice') ? styles.active : ''}`}>
                <div className={styles.icon}>🎯</div>
                <span className={styles.label}>연습</span>
            </Link>

            <Link href="/review" className={`${styles.navItem} ${isActive('/review') ? styles.active : ''}`}>
                <div className={styles.icon}>📝</div>
                <span className={styles.label}>리뷰</span>
            </Link>

            <Link href="/record" className={`${styles.navItem} ${isActive('/record') ? styles.active : ''}`}>
                <div className={styles.icon}>📅</div>
                <span className={styles.label}>기록</span>
            </Link>
        </nav>
    );
}
