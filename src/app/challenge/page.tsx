'use client';

import React, { useState, useEffect, useMemo } from 'react';
import LessonCard from '@/components/LessonCard';
import ClozeDrillApp from '../../components/ClozeDrillApp';
import styles from './ChallengePage.module.css';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

interface EnrichedItem {
    id: string;
    prompt_kr: string; // v4
    category: string;
    sub_category: string; // v4
    level: string;
    target_en: string;
    lesson_id: string;
    lesson_no: number;
    lesson_note: string;
    model_audio_url?: string; // v4
}

export default function ChallengePage() {
    const { user, logout } = useAuth();
    const [items, setItems] = useState<EnrichedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'situation' | 'lesson'>('situation');

    // Challenge Mode State
    const [activeChallengeItem, setActiveChallengeItem] = useState<EnrichedItem | null>(null);
    const [sessionId, setSessionId] = useState<string>('');

    useEffect(() => {
        async function fetchItems() {
            if (!user) return;
            try {
                const query = user.role === 'player' ? `?playerId=${user.id}&t=${Date.now()}` : `?t=${Date.now()}`;
                const res = await fetch(`/api/train/items${query}`);
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
        if (user) {
            fetchItems();
        } else {
            setLoading(false);
        }
    }, [user]);

    // Grouping Logic
    const groupedData = useMemo(() => {
        if (!items || items.length === 0) return [];

        if (viewMode === 'lesson') {
            const groups: Record<number, EnrichedItem[]> = {};
            items.forEach(item => {
                const no = item.lesson_no || 0;
                if (!groups[no]) groups[no] = [];
                groups[no].push(item);
            });
            return Object.entries(groups)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([key, val]) => ({
                    title: `Lesson ${key}`,
                    items: val
                }));
        } else {
            // Situation View: Category -> SubCategory
            const cats: Record<string, Record<string, EnrichedItem[]>> = {};
            items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                const sub = item.sub_category || 'General';
                if (!cats[cat]) cats[cat] = {};
                if (!cats[cat][sub]) cats[cat][sub] = [];
                cats[cat][sub].push(item);
            });

            return Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, subs]) => ({
                title: cat,
                subGroups: Object.entries(subs).sort((a, b) => a[0].localeCompare(b[0])).map(([sub, items]) => ({
                    title: sub,
                    items: items
                }))
            }));
        }
    }, [items, viewMode]);

    const handleItemClick = (e: React.MouseEvent, item: EnrichedItem) => {
        e.preventDefault();
        setSessionId(uuidv4());
        setActiveChallengeItem(item);
    };

    const handleChallengeClose = () => {
        setActiveChallengeItem(null);
        setSessionId('');
    };

    const handleChallengeNext = () => {
        if (!activeChallengeItem) return;
        // Logic to find next item in the flattened list for simplicity
        const idx = items.findIndex(i => i.id === activeChallengeItem.id);
        if (idx >= 0 && idx < items.length - 1) {
            setActiveChallengeItem(items[idx + 1]);
        } else {
            alert("Challenge set complete!");
            setActiveChallengeItem(null);
        }
    };

    if (activeChallengeItem) {
        return (
            <ClozeDrillApp
                item={activeChallengeItem}
                onNext={handleChallengeNext}
                onClose={handleChallengeClose}
                mode="challenge"
                sessionId={sessionId}
            />
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.title}>Challenge</div>
                    <button onClick={logout} className={styles.logoutBtn}>🚪</button>
                </div>

                <div className={styles.toggleContainer}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'situation' ? styles.active : ''}`}
                        onClick={() => setViewMode('situation')}
                    >
                        By Situation
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'lesson' ? styles.active : ''}`}
                        onClick={() => setViewMode('lesson')}
                    >
                        By Lesson
                    </button>
                </div>
            </header>

            <div className={styles.content}>
                {loading ? <p>Loading challenges...</p> : (
                    <>
                        {viewMode === 'lesson' ? (
                            groupedData.map((group: any) => (
                                <div key={group.title} className={styles.section}>
                                    <h3 className={styles.groupTitle}>{group.title}</h3>
                                    <div className={styles.list}>
                                        {group.items.map((item: EnrichedItem) => (
                                            <LessonCard
                                                key={item.id}
                                                id={item.id}
                                                category={item.category}
                                                title={item.prompt_kr}
                                                subtitle={item.sub_category}
                                                level={item.level}
                                                onClick={(e) => handleItemClick(e, item)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            groupedData.map((catGroup: any) => (
                                <div key={catGroup.title} className={styles.categoryBlock}>
                                    <h2 className={styles.categoryTitle}>{catGroup.title}</h2>
                                    {catGroup.subGroups.map((sub: any) => (
                                        <div key={sub.title} className={styles.subGroup}>
                                            <h4 className={styles.subTitle}>{sub.title}</h4>
                                            <div className={styles.list}>
                                                {sub.items.map((item: EnrichedItem) => (
                                                    <LessonCard
                                                        key={item.id}
                                                        id={item.id}
                                                        category={item.category}
                                                        title={item.prompt_kr}
                                                        subtitle={item.target_en} // Show target_en as subtitle? Or hide? 
                                                        // Request: "Minimal info: Item title only (Situation)".
                                                        // But LessonCard usually expects subtitle.
                                                        // Let's passed empty string or sub_category.
                                                        // Previously passing sub_category. 
                                                        level={item.level}
                                                        onClick={(e) => handleItemClick(e, item)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                        {items && items.length === 0 && (
                            <p className={styles.empty}>
                                No items available.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
