'use client';

import React, { useState, useEffect } from 'react';
import ClozeDrillApp from '../../components/ClozeDrillApp';
import styles from './ChallengePage.module.css';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

interface EnrichedItem {
    id: string;
    prompt_kr: string;
    category: string;
    sub_category: string;
    level: string;
    target_en: string;
    lesson_id: string;
    lesson_no: number;
    lesson_note: string;
    model_audio_url?: string;
    // New
    dialogue_prompt_en?: string;
    dialogue_speaker?: string;
    dialogue_audio_url?: string;
    challenge_type?: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';
    question_text?: string;
}

export default function ChallengePage() {
    const { user, logout } = useAuth();
    
    const [playerLevel, setPlayerLevel] = useState<string>('L1');
    const [loadingLevel, setLoadingLevel] = useState(true);

    // Session State
    const [sessionItems, setSessionItems] = useState<EnrichedItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sessionId, setSessionId] = useState<string>('');
    const [isLoadingSession, setIsLoadingSession] = useState(false);

    useEffect(() => {
        if (!user) return;
        // Fetch player level to display on Interview card
        fetch(`/api/player/info?player_id=${user.id}`).then(res => {
            if (res.ok) {
                res.json().then(data => {
                    if (data.player && data.player.level) {
                        setPlayerLevel(data.player.level);
                    }
                    setLoadingLevel(false);
                });
            } else {
                setLoadingLevel(false);
            }
        }).catch(() => setLoadingLevel(false));
    }, [user]);

    const startChallenge = async (type: 'onpitch' | 'interview', mode?: 'A' | 'B') => {
        if (!user) return;
        setIsLoadingSession(true);
        setSessionId(uuidv4());
        setCurrentIndex(0);

        try {
            let url = '';
            if (type === 'onpitch') {
                url = `/api/player/challenge?player_id=${user.id}&type=onpitch&mode=${mode}`;
            } else if (type === 'interview') {
                url = `/api/player/challenge/interview?player_id=${user.id}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
                setSessionItems(data.items);
            } else {
                alert('해당 챌린지에 배정된 항목이 없습니다.');
            }
        } catch (e) {
            console.error('Failed to start challenge', e);
            alert('챌린지를 불러오는 데 실패했습니다.');
        } finally {
            setIsLoadingSession(false);
        }
    };

    const handleChallengeNext = () => {
        if (currentIndex < sessionItems.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            alert('챌린지가 완료되었습니다! 훌륭합니다. 🎉');
            setSessionItems([]);
        }
    };

    const handleChallengeClose = () => {
        setSessionItems([]);
    };

    if (sessionItems.length > 0) {
        return (
            <ClozeDrillApp
                item={sessionItems[currentIndex]}
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
            </header>

            <div className={styles.content}>
                {/* ⚽ On-Pitch Challenge */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                         ⚽ On-Pitch Challenge
                    </div>
                    <div className={styles.cardContainer}>
                        {/* Mode A */}
                        <div className={styles.modeCard} onClick={() => startChallenge('onpitch', 'A')}>
                            <div className={styles.modeHeader}>
                                <span className={styles.modeIcon}>👀</span>
                                <h3 className={styles.modeTitle}>Mode A: Situation Speak</h3>
                            </div>
                            <p className={styles.modeDesc}>
                                화면에 나타나는 한국어 경기 상황을 보고, 가장 적절한 영어 문장으로 신속하게 스피킹하세요.
                            </p>
                            <button className={styles.startButton}>
                                {isLoadingSession ? 'Loading...' : 'Start Mode A'}
                            </button>
                        </div>

                        {/* Mode B */}
                        <div className={styles.modeCard} onClick={() => startChallenge('onpitch', 'B')}>
                            <div className={styles.modeHeader}>
                                <span className={styles.modeIcon}>👂</span>
                                <h3 className={styles.modeTitle}>Mode B: Dialogue Respond</h3>
                            </div>
                            <p className={styles.modeDesc}>
                                동료나 코치의 말을 오디오로 우선 듣고, 적절한 영어 문장으로 침착하게 응답하세요.
                            </p>
                            <button className={styles.startButton}>
                                {isLoadingSession ? 'Loading...' : 'Start Mode B'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🎙️ Interview Challenge */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        🎙️ Interview Challenge
                    </div>
                    <div className={styles.cardContainer}>
                        <div className={styles.modeCard} onClick={() => startChallenge('interview')}>
                            <div className={styles.modeHeader}>
                                <span className={styles.modeIcon}>🎤</span>
                                <h3 className={styles.modeTitle}>Level Interview</h3>
                                {!loadingLevel && (
                                    <span className={styles.levelBadge}>{playerLevel} Track</span>
                                )}
                            </div>
                            <p className={styles.modeDesc}>
                                경기 전후 실제 미디어 인터뷰 상황입니다.
                                질문을 들은 후 3초 이내에 답변 녹음을 시작해야 합니다.
                            </p>
                            <button className={styles.startButton}>
                                {isLoadingSession ? 'Loading...' : 'Start Interview'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
