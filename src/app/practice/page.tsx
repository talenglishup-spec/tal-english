'use client';

import React, { useState, useEffect } from 'react';
import LessonCard from '@/components/LessonCard';
import styles from './PracticePage.module.css';

interface TrainingItem {
    id: string;
    situation: string; // This is the English scenario title usually? No, prompt_kr is situation.
    // Making Assumption: 'category' is the English Title, 'situation' is Korean Subtitle
    category: string;
    level: string;
}

export default function PracticePage() {
    const [items, setItems] = useState<TrainingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLevel, setSelectedLevel] = useState('All');
    const [streak, setStreak] = useState(1); // Mock streak for now

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

    // Filter items based on logic
    const displayedItems = selectedLevel === 'All'
        ? items
        : items.filter(i => i.level === selectedLevel);

    // Grouping for "Recommendations" vs "Others"
    // specific logic: Just take the first 1 as "Custom Lesson" and rest as "Jump-in"
    const recommendedLesson = displayedItems[0];
    const otherLessons = displayedItems.slice(1);

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.levelSelector}>
                    <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        className={styles.dropdown}
                    >
                        <option value="All">Level All</option>
                        <option value="L0">Level 0</option>
                        <option value="L1">Level 1</option>
                        <option value="L2">Level 2</option>
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
                                />
                            ))}
                        </div>
                    )}

                    {displayedItems.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                            No lessons found for this level.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
