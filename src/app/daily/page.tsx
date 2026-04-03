'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import ClozeDrillApp from '@/components/ClozeDrillApp';
import OnPitchReactor from '@/components/OnPitchReactor';
import styles from './DailyPage.module.css';

interface TrainingItem {
    id: string;
    level: string;
    prompt_kr: string;
    target_en: string;
    category: string;
    sub_category?: string;
    practice_type?: string;
    cloze_target?: string;
}

type DailyData = {
    onpitch: TrainingItem[];
    build: TrainingItem[];
    interview: TrainingItem[];
    weak: TrainingItem[];
};

const BLOCKS = [
    { key: 'onpitch', label: 'OnPitch', desc: 'Speed & Reaction', icon: '⚡' },
    { key: 'build', label: 'Build', desc: 'Sentence Building', icon: '🏗️' },
    { key: 'interview', label: 'Interview', desc: 'Speaking Practice', icon: '🎙️' },
    { key: 'weak', label: 'Weak', desc: 'Review & Polish', icon: '🩹' }
];

export default function DailyPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [loading, setLoading] = useState(true);

    // Progression State
    const [blockIndex, setBlockIndex] = useState<number>(0); // 0, 1, 2, 3 (4 = completed)
    const [drillingState, setDrillingState] = useState<{
        items: TrainingItem[];
        index: number;
        subStep: number;
        sessionId: string;
    } | null>(null);

    const [streakComplete, setStreakComplete] = useState(false);

    useEffect(() => {
        if (!user) return;
        async function fetchDaily() {
            setLoading(true);
            try {
                const res = await fetch(`/api/daily?player_id=${user?.id}`);
                const data = await res.json();
                if (data.success) {
                    setDailyData(data.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchDaily();
    }, [user]);

    const handleStartBlock = (bIndex: number) => {
        if (!dailyData) return;
        const key = BLOCKS[bIndex].key as keyof DailyData;
        const blockItems = dailyData[key];

        if (!blockItems || blockItems.length === 0) {
            // Skip empty block
            handleBlockComplete(bIndex);
            return;
        }

        setDrillingState({
            items: blockItems,
            index: 0,
            subStep: 1,
            sessionId: uuidv4()
        });
    };

    const handleNextDrill = () => {
        setDrillingState(prev => {
            if (!prev) return prev;
            
            const { items, index, subStep } = prev;
            const currentItem = items[index];

            const rawType = (currentItem?.practice_type || 'A').toString().trim().toUpperCase();
            let type = rawType;
            if (rawType === 'A' || rawType.includes('3')) type = '3-STEP';
            else if (rawType === 'B' || rawType.includes('CLOZE')) type = '1-STEP-CLOZE';
            else if (rawType === 'C' || rawType.includes('BLANK')) type = '1-STEP-BLANK';
            else type = '3-STEP';
            
            let maxSteps = type === '3-STEP' ? 3 : 1;
            if (currentItem?.category?.toLowerCase() === 'onpitch') {
                maxSteps = 1;
            }

            if (subStep < maxSteps) {
                return { ...prev, subStep: subStep + 1 };
            } else {
                if (index < items.length - 1) {
                    return { ...prev, index: index + 1, subStep: 1 };
                } else {
                    setTimeout(() => handleBlockComplete(blockIndex), 0);
                    return null;
                }
            }
        });
    };

    const handleBlockComplete = (cIndex: number) => {
        setDrillingState(null);
        if (cIndex === 3) {
            // Finished all 4 steps
            setBlockIndex(4);
            triggerStreakComplete();
        } else {
            setBlockIndex(cIndex + 1);
        }
    };

    const triggerStreakComplete = async () => {
        // Here we could call an API to update player streak.
        // For now, we simulate the UI confirmation
        setStreakComplete(true);
    };

    // RENDER 1: DRILLING
    if (drillingState) {
        const currentItem = drillingState.items[drillingState.index];
        if (!currentItem) return <div className={styles.loading}>Error loading item</div>;

        const currentBlockLabel = BLOCKS[blockIndex].label;
        const progressStr = `${drillingState.index + 1} / ${drillingState.items.length}`;

        if (currentItem.category.toLowerCase() === 'onpitch') {
            return (
                <div className={styles.drillWrapper}>
                    <div className={styles.drillHeader}>
                        <span className={styles.drillBadge}>{currentBlockLabel}</span>
                        <span className={styles.drillProgress}>{progressStr}</span>
                    </div>
                    <OnPitchReactor
                        key={`${currentItem.id}-${drillingState.index}`}
                        item={currentItem}
                        onNext={handleNextDrill}
                        onClose={() => setDrillingState(null)}
                        sessionId={drillingState.sessionId}
                        mode="practice"
                    />
                </div>
            );
        }

        return (
            <div className={styles.drillWrapper}>
                <div className={styles.drillHeader}>
                    <span className={styles.drillBadge}>{currentBlockLabel}</span>
                    <span className={styles.drillProgress}>{progressStr}</span>
                </div>
                <ClozeDrillApp
                    key={`${currentItem.id}-${drillingState.index}-${drillingState.subStep}`}
                    item={currentItem}
                    onNext={handleNextDrill}
                    onClose={() => setDrillingState(null)}
                    mode="practice"
                    sessionId={drillingState.sessionId}
                    subStep={drillingState.subStep}
                />
            </div>
        );
    }

    // RENDER 2: 4-STEP PROGRESS BOARD
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.title}>Daily Routine</div>
                    <button onClick={() => router.push('/home')} className={styles.homeBtn}>🏠 Home</button>
                </div>
            </header>

            <div className={styles.content}>
                {loading ? (
                    <div className={styles.loading}>Generating your daily routine...</div>
                ) : !dailyData ? (
                    <div className={styles.error}>Failed to load routine.</div>
                ) : (
                    <div className={styles.board}>
                        {blockIndex < 4 ? (
                            <>
                                <h2 className={styles.boardTitle}>Your 10-Min Routine</h2>
                                <div className={styles.stepsContainer}>
                                    {BLOCKS.map((block, i) => {
                                        const isActive = blockIndex === i;
                                        const isDone = blockIndex > i;
                                        const itemsCount = dailyData[block.key as keyof DailyData]?.length || 0;

                                        return (
                                            <div key={block.key} className={`${styles.stepCard} ${isActive ? styles.active : ''} ${isDone ? styles.done : ''}`}>
                                                <div className={styles.stepIcon}>{isDone ? '✅' : block.icon}</div>
                                                <div className={styles.stepInfo}>
                                                    <h3>Step {i + 1}: {block.label}</h3>
                                                    <p>{block.desc}</p>
                                                </div>
                                                <div className={styles.stepAction}>
                                                    {isDone ? (
                                                        <span className={styles.statusLabel}>Done</span>
                                                    ) : isActive ? (
                                                        <button onClick={() => handleStartBlock(i)} className={styles.startBtn}>
                                                            Start ({itemsCount})
                                                        </button>
                                                    ) : (
                                                        <span className={styles.statusLabel}>Locked</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className={styles.completionScreen}>
                                <div className={styles.successIcon}>🔥</div>
                                <h2>Routine Completed!</h2>
                                <p>Great job taking a leap today.<br />Your streak has been updated.</p>
                                <button className={styles.primaryBtn} onClick={() => router.push('/home')}>
                                    Return to Home
                                </button>
                                <button className={styles.secondaryBtn} onClick={() => {
                                    // Reset to allow review, without streak impact
                                    setBlockIndex(0);
                                }}>
                                    Review Again
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
