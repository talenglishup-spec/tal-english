'use client';

import React from 'react';
import Link from 'next/link';
import styles from './LessonCard.module.css';

interface LessonCardProps {
    id: string;
    title: string; // e.g. "Career Discussion"
    subtitle: string; // e.g. "진로 상담"
    category: string; // icon or category name
    level?: string;
    completed?: boolean;
}

export default function LessonCard({ id, title, subtitle, category, level, completed }: LessonCardProps) {
    // Generate a consistent color/icon based on category fallback
    const getIcon = (cat: string) => {
        if (cat.includes('Pass') || cat.includes('Match')) return '⚽';
        if (cat.includes('Tac') || cat.includes('Strat')) return '📋';
        if (cat.includes('Comm')) return '🗣️';
        return '✨';
    };

    return (
        <Link href={`/train?itemId=${id}&level=${level}`} className={styles.card}>
            <div className={styles.iconContainer}>
                {getIcon(category)}
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.subtitle}>{subtitle}</p>
            </div>
            {completed && (
                <div className={styles.checkIcon}>✓</div>
            )}
        </Link>
    );
}
