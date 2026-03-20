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
    practice_type?: '3-STEP' | '1-STEP-CLOZE' | '1-STEP-BLANK' | 'A' | 'B' | string;
    cloze_target?: string;
    challenge_type?: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';
    question_text?: string;
    question_audio_url?: string;
    question_audio_en?: string;
    // v2.0 additional properties
    max_latency_ms?: number;
    expected_phrases?: string;
    // v5 matching fields
    matched_question_text?: string;
}

interface ClozeDrillProps {
    item: TrainingItem;
    onNext: () => void;
    onClose: () => void;
    mode?: 'practice' | 'challenge' | 'daily';
    sessionId: string;
    subStep?: number; // 1, 2, or 3 for 3-STEP
}

export default function ClozeDrillApp({ item, onNext, onClose, mode = 'practice', sessionId, subStep = 1 }: ClozeDrillProps) {
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
            if (isEnType) {
                setMsg('인터뷰 질문을 듣고 답변을 녹음하세요.');
            } else {
                setMsg('제시된 상황을 보고 답변을 녹음하세요.');
            }
        }

        // Auto-play logic: Manual Question Audio -> Manual Question Text (EN TTS) -> Auto-Matched Question Text (EN TTS) -> Korean Fallback (KO TTS)
        const englishQuestionText = item.question_text || item.matched_question_text;
        const hasManualAudio = !!(item.question_audio_en || item.question_audio_url);

        console.log(`[ClozeDrill] Item: ${item.id}`, { 
            hasManualAudio, 
            englishQuestionText, 
            matched: item.matched_question_text,
            manual: item.question_text,
            prompt_kr: item.prompt_kr 
        });

        if (hasManualAudio || englishQuestionText) {
            if (hasManualAudio) {
                console.log("[ClozeDrill] Auto-playing manual audio");
                playQuestionAudio();
            } else if (englishQuestionText) {
                console.log(`[ClozeDrill] Auto-playing EN TTS: ${englishQuestionText}`);
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(englishQuestionText);
                utterance.lang = 'en-US';
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
                setQuestionPlayCount(prev => prev + 1);
            }
        } else if (item.prompt_kr) {
            console.log(`[ClozeDrill] Auto-playing KO Fallback: ${item.prompt_kr}`);
            // Fallback: Auto-play Korean TTS for KO_TO_EN
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
        let audioUrl = item.question_audio_en || item.question_audio_url;
        const englishQuestionText = item.question_text || item.matched_question_text;

        if (audioUrl) {
            // Auto-fix Google Drive "view" links for direct audio playing
            if (audioUrl.includes('drive.google.com/file/d/')) {
                const match = audioUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    audioUrl = `https://docs.google.com/uc?export=download&id=${match[1]}`;
                }
            }

            setQuestionPlayCount(prev => prev + 1);
            const audio = new Audio(audioUrl);
            audio.play().catch(err => {
                console.error("Audio Play Error:", err);
                if (englishQuestionText) {
                    console.log("[ClozeDrill] Fallback to TTS after audio error");
                    const utterance = new SpeechSynthesisUtterance(englishQuestionText);
                    utterance.lang = 'en-US';
                    window.speechSynthesis.speak(utterance);
                }
            });
        } else if (englishQuestionText) {
            console.log("[ClozeDrill] Playing EN TTS (no manual audio):", englishQuestionText);
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(englishQuestionText);
            utterance.lang = 'en-US';
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
            setQuestionPlayCount(prev => prev + 1);
        }
    };

    const playModelAudio = () => {
        let audioUrl = item.model_audio_url;
        if (!audioUrl) return;

        if (audioUrl.includes('drive.google.com/file/d/')) {
            const match = audioUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                audioUrl = `https://docs.google.com/uc?export=download&id=${match[1]}`;
            }
        }

        setModelPlayCount(prev => prev + 1);
        const audio = new Audio(audioUrl);
        audio.play().catch(err => {
            console.error(err);
        });
    };

    const toggleTranslation = () => {
        // Obsolete: translation is always shown in practice mode now
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

        // v2.0 Fields
        formData.append('category', item.category || '');
        formData.append('max_latency_ms', item.max_latency_ms?.toString() || '1500');
        formData.append('expected_phrases', item.expected_phrases || '');

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
                setMsg(data.error || 'Error submitting.');
            }
        } catch (e: any) {
            console.error(e);
            setMsg('Network Error: ' + (e.message || 'Check connection'));
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
            {mode !== 'daily' && (
                <div className={styles.topBar}>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
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
            )}

            <div className={styles.content}>

                {/* Status Indicator */}
                {!result && !isSubmitting && <div className={styles.questionText}>{msg}</div>}

                {/* Loading State */}
                {isSubmitting && (
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <div className={styles.loadingText}>빠르게 분석 중입니다...</div>
                    </div>
                )}

                {/* Result Area Top - Removed AI Score for both Practice and Challenge modes as requested */}

                {/* Speaking Box for Step 1 */}
                {!result && !isSubmitting && mode === 'practice' &&
                    (() => {
                        const rawType = (item.practice_type || 'A').toString().trim().toUpperCase();
                        let type = rawType;
                        if (rawType === 'A' || rawType.includes('3')) type = '3-STEP';
                        else if (rawType === 'B' || rawType.includes('CLOZE')) type = '1-STEP-CLOZE';
                        else if (rawType === 'C' || rawType.includes('BLANK')) type = '1-STEP-BLANK';
                        else type = '3-STEP';
                        return type === '3-STEP';
                    })() && (
                        <div style={{ textAlign: 'center', marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div className={styles.stepBadge}>Step {subStep} / 3</div>
                            {subStep === 1 && <div className={styles.speakingBox}>이제 스피킹 하세요...</div>}
                        </div>
                    )}

                {/* Target or Blank Text */}
                <div className={styles.targetText}>
                    {(() => {
                        const rawType = (item.practice_type || 'A').toString().trim().toUpperCase();
                        let type: string = rawType;
                        if (rawType === 'A' || rawType.includes('3')) type = '3-STEP';
                        else if (rawType === 'B' || rawType.includes('CLOZE')) type = '1-STEP-CLOZE';
                        else if (rawType === 'C' || rawType.includes('BLANK')) type = '1-STEP-BLANK';
                        else type = '3-STEP';

                        const isClozeStep = (type === '3-STEP' && subStep === 2) || type === '1-STEP-CLOZE';
                        const isBlankStep = (type === '3-STEP' && subStep === 3) || type === '1-STEP-BLANK' || mode === 'challenge';

                        if (result || answerRevealed) {
                            return <span className={styles.targetTextNormal}>{item.target_en}</span>;
                        }

                        if (isBlankStep) {
                            // Split by words to create blank box for each word
                            return (
                                <span>
                                    {item.target_en.split(' ').map((word, i) => (
                                        <React.Fragment key={i}>
                                            <span className={styles.targetTextBlank}>{word}</span>
                                            {' '}
                                        </React.Fragment>
                                    ))}
                                </span>
                            );
                        }

                        if (isClozeStep) {
                            let hasAnyBlank = false;
                            let partsToRender: React.ReactNode[] = [];

                            if (item.cloze_target) {
                                const targets = item.cloze_target.split(',').map(t => t.trim()).filter(t => t.length > 0);

                                if (targets.length > 0) {
                                    const escapedTargets = targets.map(t => t.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&'));
                                    const pattern = new RegExp(`(${escapedTargets.join('|')})`, 'gi');

                                    const parts = item.target_en.split(pattern);
                                    partsToRender = parts.map((p, i) => {
                                        const isMatch = targets.some(t => t.toLowerCase() === p.toLowerCase());
                                        if (isMatch) hasAnyBlank = true;
                                        return isMatch
                                            ? <span key={i} className={styles.targetTextBlank}>{p}</span>
                                            : <span key={i}>{p}</span>;
                                    });
                                }
                            }

                            if (hasAnyBlank) {
                                return <span className={styles.targetTextStep1}>{partsToRender}</span>;
                            } else {
                                // Fallback: auto-blank the longest word if user forgot cloze_target or misspelled it
                                const words = item.target_en.split(' ');
                                if (words.length > 0) {
                                    let longestIdx = 0;
                                    for (let i = 1; i < words.length; i++) {
                                        if (words[i].replace(/[^A-Za-z0-9]/g, '').length > words[longestIdx].replace(/[^A-Za-z0-9]/g, '').length) {
                                            longestIdx = i;
                                        }
                                    }
                                    return (
                                        <span className={styles.targetTextStep1}>
                                            {words.map((w, i) => (
                                                <React.Fragment key={i}>
                                                    {i === longestIdx ? <span className={styles.targetTextBlank}>{w}</span> : <span>{w}</span>}
                                                    {' '}
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    );
                                }
                                return <span className={styles.targetTextStep1}>{item.target_en}</span>;
                            }
                        }

                        // Step 1: Faded gray text
                        return <span className={styles.targetTextStep1}>{item.target_en}</span>;
                    })()}
                </div>

                {mode === 'challenge' && isEnType ? (
                    <div className={styles.koreanPrompt}>
                        {item.question_text}
                    </div>
                ) : (
                    <div className={styles.koreanPrompt}>
                        {item.prompt_kr}
                    </div>
                )}

                {isEnType && (
                    <div className={styles.promptControls}>
                        {(item.question_audio_en || item.question_audio_url) && (
                            <button className={styles.actionBtn} onClick={playQuestionAudio}>
                                🔊 질문 듣기
                            </button>
                        )}
                    </div>
                )}



                <div className={styles.footerArea}>

                    {/* Audio Buttons in Result */}
                    {result && (
                        <div className={styles.audioButtons}>
                            {item.model_audio_url && (
                                <button type="button" onClick={playModelAudio} className={styles.audioBtn}>
                                    🔊 모범 발음
                                </button>
                            )}
                            {result.audio_url && (
                                <button type="button" onClick={() => new Audio(result.audio_url).play()} className={styles.audioBtn}>
                                    ▶️ 내 발음
                                </button>
                            )}
                        </div>
                    )}

                    {/* Recorder Area */}
                    {!result && !isSubmitting && (
                        <AudioRecorder
                            key={`${item.id}-${subStep}`}
                            onRecordingComplete={handleRecordingComplete}
                            silenceDuration={600}
                            autoStop={false}
                        />
                    )}

                    {/* Footer Controls */}
                    {result && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem', width: '100%' }}>
                            {mode === 'challenge' && (
                                <div className={styles.challengeFinishedText}>
                                    답안이 저장되었습니다.
                                </div>
                            )}

                            <button type="button" onClick={(e) => { e.preventDefault(); onNext(); }} className={styles.nextButton}>
                                다음으로 넘어가기
                            </button>

                            {mode !== 'challenge' && (
                                <div className={styles.retryBtnContainer} style={{ marginTop: '15px' }}>
                                    <button type="button" onClick={(e) => { e.preventDefault(); handleRetry(); }} className={styles.iconBtn} aria-label="다시 말하기">
                                        ↻
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
