'use client';

import React from 'react';
import Link from 'next/link';
import styles from './LessonCard.module.css';

export interface LessonCardProps {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    level?: string;
    completed?: boolean;
    href?: string;
    onClick?: (e: React.MouseEvent) => void;
    badgeText?: string; // New prop for "Learned in Lesson X"
}

export default function LessonCard({ id, title, subtitle, category, level, completed, href, onClick, badgeText }: LessonCardProps) {
    // Generate a consistent color/icon based on category fallback
    const getIcon = (cat: string) => {
        if (cat.includes('Pass') || cat.includes('Match')) return '⚽';
        if (cat.includes('Tac') || cat.includes('Strat')) return '📋';
        if (cat.includes('Comm')) return '🗣️';
        return '✨';
    };

    const linkHref = href || `/train?itemId=${id}&level=${level}`;

    return (
        <Link href={linkHref} className={styles.card} onClick={onClick}>
            <div className={styles.iconContainer}>
                {getIcon(category)}
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.subtitle}>{subtitle}</p>
                {badgeText && <span className={styles.badge}>{badgeText}</span>}
            </div>
            {completed && (
                <div className={styles.checkIcon}>✓</div>
            )}
        </Link>
    );
}
