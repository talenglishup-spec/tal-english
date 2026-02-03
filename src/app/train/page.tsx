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
    const [result, setResult] = useState<{ score: number; feedback: string; stt_text: string } | null>(null);
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
    };

    const handleRetake = () => {
        setAudioBlob(null);
        setResult(null);
    };

    const handleSubmit = async () => {
        if (!audioBlob) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('situation', currentItem.situation);
            formData.append('target_en', currentItem.target_en);
            formData.append('item_id', currentItem.id);
            formData.append('allowed_variations', JSON.stringify(currentItem.allowed_variations));
            formData.append('key_word', currentItem.key_word);
            formData.append('player_id', 'demo_player'); // Fixed for MVP
            formData.append('player_name', 'Player 1');  // Fixed for MVP

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
                });
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to submit attempt.');
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
                <h1 className={styles.title}>Football English</h1>
                <p className={styles.subtitle}>Scenario {currentIndex + 1} / {items.length}</p>
            </header>

            {!result ? (
                <div className={styles.card}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className={styles.situationLabel}>{currentItem.category} ({currentItem.level})</div>
                        </div>
                        <div className={styles.situationText}>{currentItem.situation}</div>

                        {/* Toggle for Practice Mode vs Test Mode */}
                        <div style={{ marginTop: '1rem' }}>
                            <button
                                onClick={() => setShowAnswer(!showAnswer)}
                                style={{
                                    background: 'none',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {showAnswer ? 'Hide Answer' : 'Show Answer'}
                            </button>
                            {showAnswer && (
                                <div className={styles.targetText}>{currentItem.target_en}</div>
                            )}
                        </div>
                    </div>

                    <div className={styles.actions}>
                        {!audioBlob ? (
                            <AudioRecorder onRecordingComplete={handleRecordingComplete} />
                        ) : (
                            <>
                                <audio controls src={URL.createObjectURL(audioBlob)} className={styles.audioPreview} />
                                <button className={styles.submitButton} onClick={handleSubmit} disabled={isSubmitting}>
                                    {isSubmitting ? 'Analyzing...' : 'Submit Answer'}
                                </button>
                                <button onClick={handleRetake} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                    Record Again
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className={styles.resultCard}>
                    <div className={styles.scoreCircle}>
                        <span className={styles.scoreValue}>{result.score}</span>
                        <span className={styles.scoreLabel}>Score</span>
                    </div>
                    <p className={styles.feedback}>{result.feedback}</p>

                    <div className={styles.sttResult}>
                        <span className={styles.sttLabel}>What we heard:</span>
                        <p>"{result.stt_text}"</p>
                    </div>

                    <button className={styles.nextButton} onClick={handleNext}>
                        Next Scenario
                    </button>
                </div>
            )}
        </div>
    );
}
