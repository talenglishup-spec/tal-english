'use client';

import React, { useState, useEffect, Suspense } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { useSearchParams } from 'next/navigation';
import styles from './TrainPage.module.css';

interface TrainingItem {
    id: string;
    situation: string;
    target_en: string;
    level: string;
    category: string;
    allowed_variations: string[];
    key_word: string;
}

export default function TrainPage() {
    return (
        <Suspense fallback={<div className={styles.page}>Loading...</div>}>
            <TrainContent />
        </Suspense>
    );
}

function TrainContent() {
    const searchParams = useSearchParams();
    const level = searchParams.get('level') || 'L0'; // Default to L0

    const [items, setItems] = useState<TrainingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string; stt_text: string; audio_url: string } | null>(null);
    const [showAnswer, setShowAnswer] = useState(false); // Default hidden (Strict Mode)

    useEffect(() => {
        async function loadItems() {
            try {
                const res = await fetch('/api/train/items');
                const data = await res.json();
                if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                    // Filter items by selected level
                    const filtered = data.items.filter((item: TrainingItem) => item.level === level);
                    setItems(filtered);
                } else {
                    console.warn('No items returned', data);
                }
            } catch (err) {
                console.error(err);
                alert('Failed to load training items.');
            } finally {
                setLoading(false);
            }
        }
        loadItems();
    }, []);

    const currentItem = items[currentIndex];

    // If loading or no items
    if (loading) {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Football English</h1>
                    <p className={styles.subtitle}>Loading Scenarios...</p>
                </header>
            </div>
        );
    }

    if (!currentItem) {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Football English</h1>
                    <p className={styles.subtitle}>No scenarios found for Level {level}.</p>
                </header>
                <div style={{ textAlign: 'center' }}>
                    <a href="/" style={{ textDecoration: 'underline' }}>Go back to Home</a>
                </div>
            </div>
        );
    }

    const handleRecordingComplete = (blob: Blob) => {
        setAudioBlob(blob);
        // Automatically submit when recording stops
        handleSubmit(blob);
    };

    const handleRetake = () => {
        setAudioBlob(null);
        setResult(null);
        setShowAnswer(false);
    };

    // Modified to accept blob directly
    const handleSubmit = async (blobToSubmit: Blob) => {
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', blobToSubmit, 'recording.webm');
            formData.append('situation', currentItem.situation);
            formData.append('target_en', currentItem.target_en);
            formData.append('item_id', currentItem.id);
            formData.append('allowed_variations', JSON.stringify(currentItem.allowed_variations));
            formData.append('key_word', currentItem.key_word);
            formData.append('player_id', 'demo_player');
            formData.append('player_name', 'Player 1');

            const res = await fetch('/api/process-attempt', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                setResult({
                    score: data.data.score,
                    feedback: data.data.feedback,
                    stt_text: data.data.stt_text,
                    audio_url: data.data.audio_url // Use returned URL
                });
                setShowAnswer(true); // Reveal answer
            } else {
                alert('Error: ' + data.error);
                // Allow retake if error
                setAudioBlob(null);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to submit attempt.');
            setAudioBlob(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        setAudioBlob(null);
        setResult(null);
        setShowAnswer(false);
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                {/* Minimal Header */}
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#999' }}>
                    Step {currentIndex + 1}
                </div>
                <div className={styles.progressBar}>
                    {items.map((_, idx) => (
                        <div
                            key={idx}
                            className={`${styles.progressSegment} ${idx <= currentIndex ? styles.activeSegment : ''}`}
                        />
                    ))}
                </div>
            </header>

            <div className={styles.mainContent}>
                {/* Question Section */}
                <div className={styles.questionSection}>
                    <p className={styles.situationLabel}>Translate into English:</p>
                    <h2 className={styles.situationTextLarge}>
                        {currentItem.situation}
                    </h2>
                </div>

                {/* Interaction Section */}
                <div className={styles.interactionSection}>

                    {/* State 1: Recording (or Loading Result) */}
                    {!result ? (
                        <div className={styles.recordingArea}>
                            {isSubmitting ? (
                                <div className={styles.loadingState}>
                                    <div className={styles.spinner}></div>
                                    <p>Analyzing...</p>
                                </div>
                            ) : (
                                // Key prop forces re-mount on item change to trigger auto-start
                                <AudioRecorder
                                    key={currentItem.id}
                                    onRecordingComplete={handleRecordingComplete}
                                />
                            )}
                        </div>
                    ) : (
                        // State 2: Result & Feedback
                        <div className={styles.resultArea}>
                            {/* Score Badge */}
                            <div className={styles.scoreBadge}>
                                {result.score === 100 ? (
                                    <div className={styles.perfectIcon}>Correct! 🎉</div>
                                ) : (
                                    <div className={styles.scoreValue}>{result.score}</div>
                                )}
                            </div>

                            {/* Answer Display */}
                            <div className={styles.answerBox}>
                                <p className={styles.answerLabel}>Correct Answer</p>
                                <h3 className={styles.targetTextLarge}>{currentItem.target_en}</h3>
                            </div>

                            {/* Feedback / My Speech */}
                            <div className={styles.feedbackBox}>
                                <p className={styles.feedbackText}>{result.feedback}</p>
                                <p className={styles.sttText}>You said: "{result.stt_text}"</p>
                            </div>

                            {/* Actions */}
                            <div className={styles.actionButtons}>
                                <button className={styles.secondaryButton} onClick={() => new Audio(result?.audio_url).play()}>
                                    ▶ My Recording
                                </button>
                                <button className={styles.nextButton} onClick={handleNext}>
                                    Next Scenario →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
