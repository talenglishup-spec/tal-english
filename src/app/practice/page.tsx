'use client';

import React, { useState, useEffect, useMemo } from 'react';
import LessonCard from '@/components/LessonCard';
import styles from './PracticePage.module.css';

interface TrainingItem {
    id: string;
    situation: string;
    category: string;
    level: string;
    target_en?: string;
}

export default function PracticePage() {
    const [items, setItems] = useState<TrainingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [streak, setStreak] = useState(1);

    useEffect(() => {
        async function fetchItems() {
            try {
                const res = await fetch('/api/train/items');
                const data = await res.json();
                if (data.items) {
                    setItems(data.items);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchItems();
    }, []);

    // Dynamic Categories: Get unique categories from items
    const categories = useMemo(() => {
        const cats = new Set(items.map(i => i.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [items]);

    const displayedItems = selectedCategory === 'All'
        ? items
        : items.filter(i => i.category === selectedCategory);

    const recommendedLesson = displayedItems[0];
    const otherLessons = displayedItems.slice(1);

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.levelSelector}>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className={styles.dropdown}
                    >
                        <option value="All">전체 보기</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.title}>Practice</div>
                <div className={styles.streak}>
                    🔥 {streak}
                </div>
            </header>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading lessons...</div>
            ) : (
                <div className={styles.content}>
                    {/* Custom Lesson Section */}
                    {recommendedLesson && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                Custom Lesson <span className={styles.badge}>New</span>
                            </h2>
                            <LessonCard
                                id={recommendedLesson.id}
                                title={recommendedLesson.category || "General Practice"}
                                subtitle={recommendedLesson.situation}
                                category={recommendedLesson.category}
                                level={recommendedLesson.level}
                            />
                        </div>
                    )}

                    {/* Jump-in Lessons Section */}
                    {otherLessons.length > 0 && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Jump-in Lessons</h2>
                            {otherLessons.map(item => (
                                <LessonCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.category || "Drill"}
                                    subtitle={item.situation}
                                    category={item.category}
                                    level={item.level}
                                // Pass English text if we want it shown, but LessonCard probably just shows titles
                                />
                            ))}
                        </div>
                    )}

                    {displayedItems.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                            No lessons found for this category.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
