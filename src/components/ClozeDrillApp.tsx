'use client';

import React, { useState, useEffect, useRef } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { useAuth } from '@/context/AuthContext';
import styles from './ClozeDrillApp.module.css';

interface TrainingItem {
    id: string;
    prompt_kr: string; // situation -> prompt_kr
    target_en: string; // target_en
    category: string;
    level: string;
    lesson_no?: number;
    model_audio_url?: string;
    // New Fields
    practice_type?: 'A' | 'B';
    cloze_target?: string;
    challenge_type?: 'Read' | 'Answer';
    question_text?: string;
    question_audio_url?: string;
}

interface ClozeDrillProps {
    item: TrainingItem;
    onNext: () => void;
    onClose: () => void;
    mode?: 'practice' | 'challenge';
}

export default function ClozeDrillApp({ item, onNext, onClose, mode = 'practice' }: ClozeDrillProps) {
    const { user } = useAuth();
    const [step, setStep] = useState(mode === 'challenge' ? 3 : 1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string; audio_url: string } | null>(null);
    const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
    const [msg, setMsg] = useState('');

    // Reset on new item
    // Initialize Step based on Mode & Type
    useEffect(() => {
        if (mode === 'challenge') {
            // Challenge Mode
            setStep(3); // Reusing Step 3 UI logic for "Final Recording" state
        } else {
            // Practice Mode
            // Type A: Start Step 1
            // Type B: Start Step 1 (but it's the only step effectively)
            setStep(1);
        }
        setResult(null);
        setIsSubmitting(false);
        setMsg('');
    }, [item, mode]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef) {
                audioRef.pause();
                audioRef.currentTime = 0;
            }
        };
    }, [audioRef]);

    // Audio Logic Consolidated
    useEffect(() => {
        // Type A - Step 1: English Model (Practice Mode and NOT result view)
        // Type B - Step 1: No auto-play model audio? Maybe yes? 
        // User requirement: "Type B: 1-step grammar drill". Text partly hidden.
        // Let's NOT auto-play model for Type B, as it gives away the answer.
        if (mode === 'practice' && item.practice_type !== 'B' && step === 1 && !result) {
            setMsg('Listen...');
            if (item.model_audio_url) {
                const audio = new Audio(item.model_audio_url);
                setAudioRef(audio);
                audio.play()
                    .then(() => {
                        // Auto advance REMOVED for Step 1
                        // audio.onended = ... 
                        setMsg('Your Turn to Speak!');
                    })
                    .catch((e) => {
                        console.error("Audio play failed", e);
                        // setTimeout(() => setStep(2), 2000); // No auto advance
                    });
            } else {
                // setTimeout(() => setStep(2), 2000);
            }
        } else if (mode === 'practice' && item.practice_type === 'B') {
            setMsg('Fill in the blank & Speak');
        }

        // Steps 2-5 (Practice) or Challenge: Korean TTS
        // Only if NOT showing result
        const shouldPlayKorean = !result && ((mode === 'challenge') || (mode === 'practice' && step > 1));

        if (shouldPlayKorean && item.prompt_kr) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(item.prompt_kr);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [step, mode, result, item]);

    // Challenge Mode: Auto-play Model Audio on Success
    useEffect(() => {
        if (mode === 'challenge' && result && item.model_audio_url) {
            const audio = new Audio(item.model_audio_url);
            audio.play().catch(e => console.error("Auto-play model failed", e));
        }
    }, [result, mode, item]);


    // Handle Recorder Completion
    const handleRecordingComplete = (blob: Blob) => {
        // Practice Type A: Steps 1 & 2 are local checks.
        // Practice Type B: Step 1 is Final (Submit).
        const isTypeA = item.practice_type !== 'B';

        if (mode === 'practice' && isTypeA && step < 3) {
            // Intermediate Steps: Local Result (No Server)
            const url = URL.createObjectURL(blob);
            setResult({
                score: 0,
                feedback: '',
                audio_url: url
            });
            setMsg('Done!');
        } else {
            // Final Step:
            // - Practice Type A Step 3
            // - Practice Type B Step 1
            // - Challenge (Step 3 state)
            handleSubmit(blob);
        }
    };

    const handleSubmit = async (blob: Blob) => {
        setIsSubmitting(true);
        setMsg('Analyzing...');
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('item_id', item.id);
        formData.append('situation', item.prompt_kr || 'Practice');
        formData.append('target_en', item.target_en || item.category);
        formData.append('measurement_type', mode === 'challenge' ? 'immediate_after' : 'baseline');

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
                setResult(data);
                setMsg('Done!');
                // For Practice Step 5, we show result. No auto-advance.
                // For Challenge, we show result.

                // EXCEPT if user wants auto-advance? 
                // Requests say "Retry and Next". So manual advance is preferred.
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

    // Handlers
    const handleRetry = () => {
        setResult(null);
        setMsg('');
    };

    const handleStepNext = () => {
        const isTypeA = item.practice_type !== 'B';

        if (mode === 'practice' && isTypeA && step < 3) {
            setStep(s => s + 1);
            setResult(null);
            setMsg('');
        } else {
            // Type B or Final Step A or Challenge -> Next Item
            onNext();
        }
    };

    // Render Text Logic
    const renderText = () => {
        const text = item.target_en;
        const isTypeB = item.practice_type === 'B';
        const isInterview = mode === 'challenge' && item.challenge_type === 'Answer';

        if (!text) return null;

        // Challenge Interview Mode: Show Question instead of Target
        // BUT if Result is shown, maybe show Target as "Model Answer"?
        // Let's stick to Requirements: "Prompt with Question".
        if (isInterview && !result) {
            return (
                <div className={styles.interviewContainer}>
                    <div className={styles.interviewLabel}>Coach's Question:</div>
                    <div className={styles.questionText}>
                        {item.question_text || "(Listen to the audio question)"}
                    </div>
                    {item.question_audio_url && (
                        <button
                            className={styles.questionAudioBtn}
                            onClick={() => new Audio(item.question_audio_url).play()}
                        >
                            Play Question 🔊
                        </button>
                    )}
                </div>
            );
        }

        // --- Practice Type B: 1-Step Cloze ---
        if (isTypeB && mode === 'practice') {
            // Logic: Hide `cloze_target` string within `text`
            // Simple string replace for MVP (case-insensitive?)
            if (!item.cloze_target) return <div className={styles.fullText}>{text}</div>;

            // Split by target to insert blanks
            const parts = text.split(new RegExp(`(${item.cloze_target})`, 'gi'));
            return (
                <div className={styles.fullText}>
                    {parts.map((part, i) => {
                        if (part.toLowerCase() === item.cloze_target!.toLowerCase()) {
                            return <span key={i} className={styles.typeBBlank}>______</span>;
                        }
                        return <span key={i}>{part}</span>;
                    })}
                </div>
            );
        }

        // --- Practice Type A (Step 1 or Result) OR Challenge (Read Mode) ---
        if ((mode === 'practice' && step === 1) || result || (mode === 'challenge' && item.challenge_type !== 'Answer')) {
            // Full Text shown in Step 1 or Result View
            return <div className={styles.fullText}>{text}</div>;
        }

        // --- Practice Type A (Step 3) OR Interview Result View ---
        if (step === 3 || mode === 'challenge') {
            // Hidden (Step 3 or Challenge Read Mode hidden)
            // For Interview Mode, we already handled !result above. If result, we fall here?
            // Actually, for Interview Result, we might want to show the Model Answer (Target).
            // So if result is true, we hit the block above (fullText).

            // So this block is purely for "Hiding Script" state.
            return <div className={styles.hiddenText}>???</div>;
        }

        // --- Practice Type A (Step 2) ---
        // Partial Masking
        const words = text.split(' ');
        return (
            <div className={styles.clozeContainer}>
                {words.map((word, i) => {
                    // Simple stable logic for Step 2:
                    let show = true;
                    if (step === 2) show = i % 2 === 0;

                    if (!show) {
                        const width = word.length * 12 + 10;
                        return <span key={i} className={styles.blank} style={{ width: `${width}px` }} />;
                    }
                    return <span key={i} className={styles.word}>{word}</span>;
                })}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>

            <div className={styles.content}>
                <div className={styles.stepIndicator}>
                    {mode === 'practice' ? (
                        item.practice_type === 'B' ? (
                            // Type B: Simple Title
                            <div className={styles.simpleTitle}>Grammar Drill</div>
                        ) : (
                            // Type A: Progress Bar
                            <div className={styles.progressBar}>
                                <div className={`${styles.stepDot} ${step >= 1 ? styles.active : ''}`}>1</div>
                                <div className={styles.stepLine}></div>
                                <div className={`${styles.stepDot} ${step >= 2 ? styles.active : ''}`}>2</div>
                                <div className={styles.stepLine}></div>
                                <div className={`${styles.stepDot} ${step >= 3 ? styles.active : ''}`}>3</div>
                            </div>
                        )
                    ) : (
                        item.challenge_type === 'Answer' ? 'Interview Challenge 🎤' : 'Reading Challenge 📖'
                    )}
                </div>

                <h2 className={styles.koreanPrompt}>
                    {item.prompt_kr || item.category}
                </h2>

                <div className={styles.sentenceArea}>
                    {renderText()}
                </div>

                <div className={styles.footerArea}>
                    <div className={styles.statusMsg}>{msg}</div>

                    {/* Recorder: Enabled for Steps 1-3 (Practice) and Challenge */}
                    {/* Step 1: Listen & Shadow (Full text) */}
                    {/* Step 2: Practice (Partial) */}
                    {/* Step 3: Master (Hidden) */}
                    {!result && !isSubmitting && (
                        <div className={styles.inputArea}>
                            {/* NEW: Only show Model Audio in Practice Mode */}
                            {mode === 'practice' && item.model_audio_url && (
                                <button
                                    className={`${styles.audioBtn} ${styles.listeningBtn}`}
                                    onClick={() => new Audio(item.model_audio_url!).play()}
                                >
                                    Listen 🔊
                                </button>
                            )}
                            <AudioRecorder
                                key={`${item.id}-${step}`}
                                onRecordingComplete={handleRecordingComplete}
                                silenceDuration={1000}
                                autoStop={true}
                            />
                        </div>
                    )}

                    {result && (
                        <div className={styles.resultArea}>
                            {result.score > 0 && <div className={styles.score}>Score: {result.score}</div>}

                            <div className={styles.audioButtons}>
                                {item.model_audio_url && (
                                    <button onClick={() => new Audio(item.model_audio_url).play()} className={`${styles.audioBtn} ${styles.model}`}>
                                        Sound 🔊
                                    </button>
                                )}
                                {result.audio_url && (
                                    <button onClick={() => new Audio(result.audio_url).play()} className={`${styles.audioBtn} ${styles.user}`}>
                                        Me 🎤
                                    </button>
                                )}
                                <button onClick={handleRetry} className={`${styles.audioBtn} ${styles.retry}`}>
                                    Retry ↺
                                </button>
                            </div>

                            <button onClick={handleStepNext} className={styles.nextButton}>
                                {mode === 'practice' && item.practice_type !== 'B' && step < 3 ? 'Next Step →' : 'Next Item →'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
