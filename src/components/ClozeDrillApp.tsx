'use client';

import React, { useState, useEffect, useRef } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { useAuth } from '@/context/AuthContext';
import styles from './ClozeDrillApp.module.css';

interface TrainingItem {
    id: string;
    prompt_kr: string;
    target_en: string;
    category: string;
    level: string;
    lesson_no?: number;
    model_audio_url?: string;
    challenge_type?: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';
    question_text?: string;
    question_audio_url?: string;
}

interface ClozeDrillProps {
    item: TrainingItem;
    onNext: () => void;
    onClose: () => void;
    mode?: 'practice' | 'challenge';
    sessionId: string;
}

export default function ClozeDrillApp({ item, onNext, onClose, mode = 'practice', sessionId }: ClozeDrillProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string; audio_url: string; stt_text: string } | null>(null);
    const [msg, setMsg] = useState('');

    // Tracking variables
    const initTime = useRef<number>(Date.now());
    const [questionPlayCount, setQuestionPlayCount] = useState(0);
    const [modelPlayCount, setModelPlayCount] = useState(0);
    const [translationToggleCount, setTranslationToggleCount] = useState(0);
    const [answerRevealed, setAnswerRevealed] = useState(false);

    // UI state
    const [showTranslation, setShowTranslation] = useState(false);

    const challengeType = item.challenge_type || 'FOOTBALL_KO_TO_EN';
    const isEnType = challengeType === 'FOOTBALL_ENQ_TO_EN' || challengeType === 'INTERVIEW_ENQ_TO_EN';

    useEffect(() => {
        // Reset state on new item
        setResult(null);
        setIsSubmitting(false);
        setMsg('');
        initTime.current = Date.now();
        setQuestionPlayCount(0);
        setModelPlayCount(0);
        setTranslationToggleCount(0);
        setAnswerRevealed(false);
        setShowTranslation(!isEnType); // If KO to EN, translation (KR) is always shown.

        if (mode === 'practice') {
            setMsg('Practice: Ready to speak!');
        } else {
            setMsg('Challenge: Recording starts immediately after prompt.');
        }

        // Auto-play question if it exists and is EN type
        if (isEnType && item.question_audio_url) {
            playQuestionAudio();
        } else if (!isEnType && item.prompt_kr) {
            // Auto-play Korean TTS for KO_TO_EN
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(item.prompt_kr);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [item, mode, isEnType]);

    const playQuestionAudio = () => {
        if (!item.question_audio_url) return;
        setQuestionPlayCount(prev => prev + 1);
        const audio = new Audio(item.question_audio_url);
        audio.play().catch(console.error);
    };

    const playModelAudio = () => {
        if (!item.model_audio_url) return;
        setModelPlayCount(prev => prev + 1);
        const audio = new Audio(item.model_audio_url);
        audio.play().catch(console.error);
    };

    const toggleTranslation = () => {
        if (!showTranslation) {
            setTranslationToggleCount(prev => prev + 1);
        }
        setShowTranslation(!showTranslation);
    };

    const revealAnswer = () => {
        setAnswerRevealed(true);
    };

    const handleRecordingComplete = (blob: Blob, duration_sec: number) => {
        handleSubmit(blob, duration_sec);
    };

    const handleSubmit = async (blob: Blob, duration_sec: number) => {
        setIsSubmitting(true);
        setMsg('Analyzing...');

        const timeToFirstResponseMs = Date.now() - initTime.current;

        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('item_id', item.id);
        formData.append('target_en', item.target_en || item.category);
        formData.append('measurement_type', mode === 'challenge' ? 'immediate_after' : 'baseline');

        formData.append('session_id', sessionId);
        formData.append('session_mode', mode);
        formData.append('challenge_type', challengeType);

        formData.append('duration_sec', duration_sec.toString());
        formData.append('time_to_first_response_ms', timeToFirstResponseMs.toString());
        formData.append('question_play_count', questionPlayCount.toString());
        formData.append('model_play_count', modelPlayCount.toString());
        formData.append('translation_toggle_count', translationToggleCount.toString());
        formData.append('answer_revealed', answerRevealed ? 'true' : 'false');

        if (user) {
            formData.append('player_id', user.id);
            formData.append('player_name', user.name);
        }

        try {
            const res = await fetch('/api/process-attempt', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data.data);
                if (mode === 'challenge') {
                    setMsg('Challenge Answer Recorded!');
                } else {
                    setMsg('Done!');
                }
            } else {
                setMsg('Error submitting.');
            }
        } catch (e) {
            console.error(e);
            setMsg('Network Error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        setResult(null);
        setMsg('');
        initTime.current = Date.now();
    };

    return (
        <div className={styles.container}>
            <div className={styles.topBar}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>
                <div className={styles.progressBar}>
                    <div className={`${styles.progressDot} ${styles.active}`}></div>
                    <div className={styles.progressDot}></div>
                    <div className={styles.progressDot}></div>
                    <div className={styles.progressDot}></div>
                    <div className={styles.progressDot}></div>
                </div>
                <div className={styles.modeIndicator}>
                    {mode === 'practice' ? '연습' : '챌린지'}
                </div>
            </div>

            <div className={styles.content}>

                {/* Status Indicator */}
                {!result && <div className={styles.questionText}>{msg}</div>}

                {/* Result Area Top */}
                {result && (
                    <div className={styles.resultBox}>
                        <div className={styles.score}>
                            {result.score >= 80 ? '✅' : '⚠️'} {result.score}점
                        </div>
                    </div>
                )}

                {/* Target or Blank Text */}
                <div className={styles.targetText}>
                    {result ? (
                        <span>{item.target_en}</span>
                    ) : answerRevealed || mode !== 'practice' ? (
                        <span>{mode === 'practice' ? item.target_en : '...'}</span>
                    ) : (
                        <span className={styles.targetTextBlank}>I'm _______ an echo _______ .</span>
                    )}
                </div>

                <div className={styles.koreanPrompt}>{item.prompt_kr}</div>

                {isEnType && (
                    <div className={styles.promptControls}>
                        {item.question_audio_url && (
                            <button className={styles.actionBtn} onClick={playQuestionAudio}>
                                🔊 질문 듣기
                            </button>
                        )}
                        <button className={styles.actionBtn} onClick={toggleTranslation}>
                            {showTranslation ? '해석 숨기기' : '해석 보기'}
                        </button>
                    </div>
                )}

                {/* Practice Mode: Reveal Button */}
                {mode === 'practice' && !result && !answerRevealed && (
                    <div className={styles.practiceRevealArea}>
                        <button className={styles.revealBtn} onClick={revealAnswer}>
                            정답 확인
                        </button>
                    </div>
                )}

                <div className={styles.footerArea}>

                    {/* Audio Buttons in Result */}
                    {result && mode === 'practice' && (
                        <div className={styles.audioButtons}>
                            {item.model_audio_url && (
                                <button onClick={playModelAudio} className={styles.audioBtn}>
                                    🔊 모범 발음
                                </button>
                            )}
                            {result.audio_url && (
                                <button onClick={() => new Audio(result.audio_url).play()} className={styles.audioBtn}>
                                    ▶️ 내 발음
                                </button>
                            )}
                        </div>
                    )}

                    {/* Recorder Area */}
                    {!result && !isSubmitting && (
                        <AudioRecorder
                            key={item.id}
                            onRecordingComplete={handleRecordingComplete}
                            silenceDuration={1000}
                            autoStop={true}
                        />
                    )}

                    {/* Footer Controls */}
                    {result && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem', width: '100%' }}>
                            {mode === 'practice' && (
                                <button onClick={handleRetry} className={styles.iconBtn}>
                                    ↻
                                </button>
                            )}
                            {mode === 'challenge' && (
                                <div className={styles.challengeFinishedText}>
                                    답안이 저장되었습니다.
                                </div>
                            )}
                            <button onClick={onNext} className={styles.nextButton}>
                                다음으로 넘어가기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
