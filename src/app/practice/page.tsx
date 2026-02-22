'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ClozeDrillApp from '../../components/ClozeDrillApp';
import styles from './PracticePage.module.css';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Types matching API and Sheets v4
interface Lesson {
    lesson_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
}

interface TrainingItem {
    id: string;
    prompt_kr: string; // v4
    category: string;
    sub_category: string; // v4
    level: string;
    target_en: string;
    lesson_no?: number;
    model_audio_url?: string; // v4
    practice_type?: '3-STEP' | '1-STEP-CLOZE' | '1-STEP-BLANK' | 'A' | 'B' | string;
    cloze_target?: string;
}

interface SituationGroup {
    situation: {
        situation_id: string;
        situation_title_ko: string;
        note: string;
    };
    items: TrainingItem[];
}

// DrillSession component removed to lift state to PracticeContent

function PracticeContent() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const lessonId = searchParams?.get('lessonId');

    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [lessonContent, setLessonContent] = useState<SituationGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // Navigation State
    const [activeSituation, setActiveSituation] = useState<SituationGroup | null>(null);
    const [drillingState, setDrillingState] = useState<{
        items: TrainingItem[];
        index: number;
        subStep: number;
        sessionId: string;
    } | null>(null);

    // 1. Fetch Lessons (if no lessonId)
    useEffect(() => {
        if (!user || lessonId) return;
        async function fetchLessons() {
            setLoading(true);
            try {
                const res = await fetch(`/api/train/lessons?playerId=${user?.id}&t=${Date.now()}`);
                const data = await res.json();
                if (data.lessons) setLessons(data.lessons);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchLessons();
    }, [user, lessonId]);

    // 2. Fetch Content (if lessonId)
    useEffect(() => {
        if (!user || !lessonId) return;
        async function fetchContent() {
            setLoading(true);
            try {
                const res = await fetch(`/api/train/lesson-content?lessonId=${lessonId}&t=${Date.now()}`);
                const data = await res.json();
                if (data.content) setLessonContent(data.content);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchContent();
    }, [user, lessonId]);

    const handleSituationClick = (group: SituationGroup) => {
        if (group.items.length === 0) {
            alert("No items in this situation.");
            return;
        }
        setActiveSituation(group);
        setDrillingState(null);
    };

    const handleNextDrill = () => {
        if (!drillingState) return;
        const { items, index, subStep, sessionId } = drillingState;
        const currentItem = items[index];

        const rawType = (currentItem?.practice_type || 'A').toString().trim().toUpperCase();
        let type = rawType;
        if (rawType === 'A' || rawType.includes('3')) type = '3-STEP';
        else if (rawType === 'B' || rawType.includes('CLOZE')) type = '1-STEP-CLOZE';
        else if (rawType === 'C' || rawType.includes('BLANK')) type = '1-STEP-BLANK';
        else type = '3-STEP';
        const maxSteps = type === '3-STEP' ? 3 : 1;

        if (subStep < maxSteps) {
            setDrillingState({ ...drillingState, subStep: subStep + 1 });
        } else {
            if (index < items.length - 1) {
                setDrillingState({ ...drillingState, index: index + 1, subStep: 1 });
            } else {
                alert("Situation Complete!");
                setDrillingState(null);
            }
        }
    };

    // Grouping Logic for Active Situation
    const groupedItems = useMemo(() => {
        if (!activeSituation) return null;

        const groups: Record<string, Record<string, TrainingItem[]>> = {};

        activeSituation.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            const sub = item.sub_category || 'General';
            if (!groups[cat]) groups[cat] = {};
            if (!groups[cat][sub]) groups[cat][sub] = [];
            groups[cat][sub].push(item);
        });

        return Object.entries(groups).map(([cat, subs]) => ({
            category: cat,
            subCategories: Object.entries(subs).map(([sub, items]) => ({
                title: sub,
                items: items
            }))
        }));
    }, [activeSituation]);


    // RENDER: Drill Mode
    if (activeSituation && drillingState) {
        const currentItem = drillingState.items[drillingState.index];
        if (!currentItem) return <p>Error loading item</p>;

        return (
            <ClozeDrillApp
                key={`${currentItem.id}-${drillingState.index}-${drillingState.subStep}`}
                item={currentItem}
                onNext={handleNextDrill}
                onClose={() => setDrillingState(null)}
                mode="practice"
                sessionId={drillingState.sessionId}
                subStep={drillingState.subStep}
            />
        );
    }

    // RENDER: Situation Content View (Item List)
    if (activeSituation && groupedItems) {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <button onClick={() => setActiveSituation(null)} className={styles.backBtn}>← Back to Situations</button>
                    <div className={styles.headerTitle}>{activeSituation.situation.situation_title_ko}</div>
                </header>

                <div className={styles.content}>
                    <div className={styles.introCard}>
                        <p>{activeSituation.situation.note}</p>
                        <button className={styles.startDrillBtn} onClick={() => setDrillingState({ items: activeSituation.items, index: 0, subStep: 1, sessionId: uuidv4() })}>
                            전체 표현 학습하기 ({activeSituation.items.length}개) ▶
                        </button>
                    </div>

                    <div className={styles.itemList}>
                        {groupedItems.map(group => (
                            <div key={group.category} className={styles.groupBlock}>
                                <h3 className={styles.groupTitle}>{group.category}</h3>
                                {group.subCategories.map(sub => (
                                    <div key={sub.title} className={styles.subBlock}>
                                        <h4 className={styles.subTitle}>{sub.title}</h4>
                                        {sub.items.map(item => (
                                            <div key={item.id} className={styles.itemRow}>
                                                <div className={styles.itemContent}>
                                                    <div className={styles.itemPrompt}>{item.prompt_kr}</div>
                                                    <div className={styles.itemTarget}>{item.target_en}</div>
                                                </div>
                                                <button
                                                    className={styles.itemDrillBtn}
                                                    onClick={() => setDrillingState({ items: [item], index: 0, subStep: 1, sessionId: uuidv4() })}
                                                >
                                                    학습하기
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // RENDER: Main (Lessons or Situations List)
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.title}>Practice</div>
                    <button onClick={logout} className={styles.logoutBtn}>🚪</button>
                </div>
            </header>

            <div className={styles.content}>
                {loading ? <p>Loading...</p> : (
                    <>
                        {!lessonId ? (
                            // STEP 1: LESSON LIST VIEW
                            <div className={styles.lessonList}>
                                {lessons.length > 0 ? lessons.map(l => (
                                    <div
                                        key={l.lesson_id}
                                        className={styles.lessonCard}
                                        onClick={() => router.push(`/practice?lessonId=${l.lesson_id}`)}
                                    >
                                        <div className={styles.lessonIcon}>📚</div>
                                        <div className={styles.lessonInfo}>
                                            <h3>Lesson {l.lesson_no}</h3>
                                            <p>{l.note}</p>
                                        </div>
                                        <div className={styles.arrow}>›</div>
                                    </div>
                                )) : <p>No lessons found.</p>}
                            </div>
                        ) : (
                            // STEP 2: SITUATION LIST VIEW
                            <div className={styles.situationView}>
                                <button onClick={() => router.push('/practice')} className={styles.backBtn}>← All Lessons</button>
                                <h2 className={styles.pageTitle}>Select a Situation</h2>

                                <div className={styles.grid}>
                                    {lessonContent.length > 0 ? lessonContent.map(group => (
                                        <div
                                            key={group.situation.situation_id}
                                            className={styles.situationCard}
                                            onClick={() => handleSituationClick(group)}
                                        >
                                            <div className={styles.cardHeader}>
                                                <span className={styles.itemCount}>{group.items.length} items</span>
                                            </div>
                                            <h3>{group.situation.situation_title_ko}</h3>
                                            {group.situation.note && <p>{group.situation.note}</p>}
                                            <div className={styles.startLabel}>View Items →</div>
                                        </div>
                                    )) : <p>No situations found for this lesson.</p>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function PracticePage() {
    return (
        <Suspense fallback={<p>Loading Practice...</p>}>
            <PracticeContent />
        </Suspense>
    );
}
