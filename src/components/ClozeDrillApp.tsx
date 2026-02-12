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
    model_audio_url?: string; // New
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
    useEffect(() => {
        setStep(mode === 'challenge' ? 3 : 1);
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
        // Step 1: English Model (Practice Mode and NOT result view)
        if (mode === 'practice' && step === 1 && !result) {
            setMsg('Listen...');
            if (item.model_audio_url) {
                const audio = new Audio(item.model_audio_url);
                setAudioRef(audio);
                audio.play()
                    .then(() => {
                        // Auto advance after play
                        audio.onended = () => setTimeout(() => setStep(2), 500);
                    })
                    .catch((e) => {
                        console.error("Audio play failed", e);
                        setTimeout(() => setStep(2), 2000);
                    });
            } else {
                setTimeout(() => setStep(2), 2000);
            }
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
        if (mode === 'practice' && step < 3) {
            // Intermediate Steps: Local Result (No Server)
            const url = URL.createObjectURL(blob);
            setResult({
                score: 0,
                feedback: '',
                audio_url: url
            });
            setMsg('Done!');
        } else {
            // Final Step (Practice Step 3 or Challenge): Submit to Server
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
        if (mode === 'practice' && step < 3) {
            setStep(s => s + 1);
            setResult(null);
            setMsg('');
        } else {
            onNext();
        }
    };

    // Render Text Logic
    const renderText = () => {
        const text = item.target_en;
        if (!text) return null;

        if (step === 1 || result) {
            // Full Text shown in Step 1 or Result View
            return <div className={styles.fullText}>{text}</div>;
        }

        if (step === 3 || mode === 'challenge') {
            // Hidden (Step 3 or Challenge - Capture 8 style)
            // Just return empty or placeholder?
            // User: "Script not visible".
            // Let's use a blurred or hidden placeholder.
            return <div className={styles.hiddenText}>???</div>;
        }

        // Step 2: Partial Masking (Replacing old steps 2-4)
        const words = text.split(' ');

        return (
            <div className={styles.clozeContainer}>
                {words.map((word, i) => {
                    // Simple stable logic for Step 2:
                    // Hide every other word or random? 
                    // Let's hide ~50% (every even index)
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
                        <div className={styles.progressBar}>
                            <div className={`${styles.stepDot} ${step >= 1 ? styles.active : ''}`}>1</div>
                            <div className={styles.stepLine}></div>
                            <div className={`${styles.stepDot} ${step >= 2 ? styles.active : ''}`}>2</div>
                            <div className={styles.stepLine}></div>
                            <div className={`${styles.stepDot} ${step >= 3 ? styles.active : ''}`}>3</div>
                        </div>
                    ) : 'Challenge Mode'}
                </div>

                <h2 className={styles.koreanPrompt}>
                    {item.prompt_kr || item.category}
                </h2>

                <div className={styles.sentenceArea}>
                    {renderText()}
                </div>

                <div className={styles.footerArea}>
                    <div className={styles.statusMsg}>{msg}</div>

                    {/* Recorder: Only for Steps 2-5, and not if submitting/result */}
                    {step > 1 && !result && !isSubmitting && (
                        <AudioRecorder
                            key={`${item.id}-${step}`}
                            onRecordingComplete={handleRecordingComplete}
                            silenceDuration={1000}
                            autoStop={true}
                        />
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
                                {mode === 'practice' && step < 3 ? 'Next Step →' : 'Next Item →'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
