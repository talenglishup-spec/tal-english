'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

export default function BottomNav() {
    const pathname = usePathname();

    // Hide on the specific drill page itself if desired, or keep it. 
    // Usually drill pages hide nav to focus attention, but user request implies global nav.
    // For now, let's keep it visible everywhere or hide on specific routes if needed.
    // If the user wants to focus on training, we might hide it on /train, but let's stick to showing it for now.

    // Check active state
    const isActive = (path: string) => pathname === path || pathname?.startsWith(path);

    return (
        <nav className={styles.bottomNav}>
            <Link href="/practice" className={`${styles.navItem} ${isActive('/practice') || pathname === '/' ? styles.active : ''}`}>
                <div className={styles.icon}>🏠</div>
                <span className={styles.label}>연습</span>
            </Link>

            <Link href="/review" className={`${styles.navItem} ${isActive('/review') ? styles.active : ''}`}>
                <div className={styles.icon}>📝</div>
                <span className={styles.label}>리뷰</span>
            </Link>

            <Link href="/challenge" className={`${styles.navItem} ${isActive('/challenge') ? styles.active : ''}`}>
                <div className={styles.icon}>🏆</div>
                <span className={styles.label}>챌린지</span>
            </Link>
        </nav>
    );
}
