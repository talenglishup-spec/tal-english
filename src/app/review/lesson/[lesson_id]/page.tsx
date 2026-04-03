'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import styles from '../../LessonReview.module.css';
import OnPitchReactor from '@/components/OnPitchReactor';
import ClozeDrillApp from '@/components/ClozeDrillApp';

export default function LessonReviewDetail() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const params = useParams();
    const lessonId = params.lesson_id as string;

    const [lessonData, setLessonData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Drilling State
    const [drillingState, setDrillingState] = useState<{
        items: any[];
        index: number;
        subStep: number;
        sessionId: string;
        mode: string;
    } | null>(null);

    useEffect(() => {
        if (!user || !lessonId) return;
        fetchLessonDetail();
    }, [user, lessonId]);

    const fetchLessonDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/review/lesson/${lessonId}?playerId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                setLessonData(data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLaunch = async (mode: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/review/lesson/${lessonId}/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: user?.id,
                    mode
                })
            });
            const data = await res.json();
            if (data.success && data.data.items && data.data.items.length > 0) {
                setDrillingState({
                    items: data.data.items,
                    index: 0,
                    subStep: 1,
                    sessionId: uuidv4(),
                    mode
                });
            } else {
                alert("No items found for this mode. Try another method.");
            }
        } catch (e) {
            console.error(e);
            alert("Error launching session");
        } finally {
            setLoading(false);
        }
    };

    const handleNextDrill = () => {
        setDrillingState(prev => {
            if (!prev) return prev;
            
            const { items, index, subStep } = prev;
            const currentItem = items[index];

            let maxSteps = 3;
            if (currentItem?.category?.toLowerCase() === 'onpitch') {
                maxSteps = 1;
            }

            if (subStep < maxSteps) {
                return { ...prev, subStep: subStep + 1 };
            } else {
                if (index < items.length - 1) {
                    return { ...prev, index: index + 1, subStep: 1 };
                } else {
                    setTimeout(() => {
                        fetchLessonDetail();
                        alert("Review Set Completed!");
                    }, 0);
                    return null;
                }
            }
        });
    };

    const handleClose = () => {
        if (confirm("Are you sure you want to stop this training session?")) {
            setDrillingState(null);
            fetchLessonDetail(); // Refresh to catch partial saves
        }
    };

    // DRILL RENDER
    if (drillingState) {
        const currentItem = drillingState.items[drillingState.index];
        if (!currentItem) return <div>Error loading item</div>;

        const progressStr = `${drillingState.index + 1} / ${drillingState.items.length}`;

        if (currentItem.category.toLowerCase() === 'onpitch') {
            return (
                <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <div className={styles.drillHeader}>
                        <span className={styles.drillBadge}>L{lessonData?.lesson_meta?.lesson_no} {drillingState.mode.toUpperCase()}</span>
                        <span className={styles.drillProgress}>{progressStr}</span>
                    </div>
                    <OnPitchReactor
                        key={`${currentItem.id}-${drillingState.index}`}
                        item={currentItem}
                        onNext={handleNextDrill}
                        onClose={handleClose}
                        sessionId={drillingState.sessionId}
                        mode="practice"
                    />
                </div>
            );
        }

        return (
            <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.drillHeader}>
                    <span className={styles.drillBadge}>L{lessonData?.lesson_meta?.lesson_no} {drillingState.mode.toUpperCase()}</span>
                    <span className={styles.drillProgress}>{progressStr}</span>
                </div>
                <ClozeDrillApp
                    key={`${currentItem.id}-${drillingState.index}-${drillingState.subStep}`}
                    item={currentItem}
                    onNext={handleNextDrill}
                    onClose={handleClose}
                    mode="practice"
                    sessionId={drillingState.sessionId}
                    subStep={drillingState.subStep}
                />
            </div>
        );
    }

    if (!user) return null;

    if (loading && !lessonData) {
        return <div className={styles.page}><div className={styles.loading}>Loading detail...</div></div>;
    }

    const { lesson_meta, situations, weak_items } = lessonData || {};

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button onClick={() => router.push('/review/lesson')} className={styles.backBtn}>← Back</button>
            </header>

            <div className={styles.content}>
                <div className={styles.lessonOverview}>
                    <span className={styles.lessonTypeBadge}>{lesson_meta?.lesson_type?.toUpperCase()}</span>
                    <h2>Lesson {lesson_meta?.lesson_no}: {lesson_meta?.lesson_title_ko}</h2>

                    <div className={styles.actionPanel}>
                        <button className={styles.actionBtn} onClick={() => handleLaunch('rerun')}>
                            🔄 Re-Run All
                        </button>
                        <button
                            className={`${styles.actionBtn} ${styles.actionBtnWeak}`}
                            onClick={() => handleLaunch('weak_only')}
                            disabled={!weak_items || weak_items.length === 0}
                        >
                            🩹 Weak Only ({weak_items?.length || 0})
                        </button>
                        <button
                            className={`${styles.actionBtn} ${styles.actionBtnQuick}`}
                            onClick={() => handleLaunch('quick5')}
                        >
                            ⚡ Quick 5
                        </button>
                    </div>
                </div>

                <div className={styles.situationsList}>
                    <h3>Situations in this Lesson</h3>
                    {situations?.map((sit: any) => {
                        return (
                            <div key={sit.situation_id} className={styles.situationCard}>
                                <div className={styles.sitHeader}>
                                    <h4>{sit.title}</h4>
                                    <span className={styles.sitCount}>{sit.items.length} items</span>
                                </div>
                                <div className={styles.itemsBlock}>
                                    {sit.items.map((it: any) => {
                                        const isWeak = it.last_status === 'failed' || it.last_status === 'unattempted' || (it.last_score !== null && it.last_score < 60);
                                        return (
                                            <div key={it.item_id} className={styles.itemRow}>
                                                <div className={styles.itemTags}>
                                                    <span className={`${styles.statusDot} ${styles['dot_' + it.last_status]}`} />
                                                    <span className={styles.itemCat}>{it.category}</span>
                                                </div>
                                                <div className={styles.itemText}>
                                                    <div>{it.prompt_kr}</div>
                                                    <div className={styles.itemEn}>{it.target_en}</div>
                                                </div>
                                                {isWeak && <span className={styles.weakBadge}>Weak</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
