'use client';

import React, { useState, useEffect, Suspense } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './TrainPage.module.css';

interface TrainingItem {
    id: string;
    situation: string; // The Korean Prompt
    category: string;  // We use this as the English Answer Target for now
    level: string;
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
    const router = useRouter();
    const level = searchParams.get('level') || 'L0';
    const itemId = searchParams.get('itemId');

    const [items, setItems] = useState<TrainingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string; stt_text: string; audio_url: string } | null>(null);

    // Fetch Items
    useEffect(() => {
        async function loadItems() {
            try {
                const res = await fetch('/api/train/items');
                const data = await res.json();
                if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                    let filtered = data.items;
                    if (itemId) {
                        filtered = data.items.filter((item: TrainingItem) => item.id === itemId);
                    } else {
                        filtered = data.items.filter((item: TrainingItem) => item.level === level);
                    }
                    setItems(filtered);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadItems();
    }, [level, itemId]);

    const currentItem = items[currentIndex];

    // Handle audio stop -> submit
    const handleRecordingComplete = (blob: Blob) => {
        setAudioBlob(blob);
        handleSubmit(blob);
    };

    const handleSubmit = async (blobToSubmit: Blob) => {
        if (!currentItem) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('audio', blobToSubmit, 'recording.webm');
        formData.append('itemId', currentItem.id);
        formData.append('situation', currentItem.situation);
        // Note: process-attempt uses prompt (English) usually. 
        // We'll pass category as prompt for now if API needs it? 
        // process-attempt mostly looks up by id? No, it often relies primarily on what we send.
        // Let's rely on the API looking up the item or us sending the "target".
        // Current API `process-attempt` might pull details from Sheets or just use body.
        // To be safe, we rely on existing logic.

        try {
            const res = await fetch('/api/process-attempt', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (res.ok) {
                setResult(data);
            } else {
                alert('Error: ' + (data.error || 'Submission failed'));
                // Determine if we should show result anyway? No.
            }
        } catch (e) {
            console.error(e);
            alert('Network error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setResult(null);
            setAudioBlob(null);
        } else {
            alert('Training complete for this session!');
            router.back();
        }
    };

    const handleRetry = () => {
        setResult(null);
        setAudioBlob(null);
        setIsSubmitting(false);
    };

    // TTS Logic
    const playModelAudio = () => {
        if (!currentItem) return;
        const textToSpeak = currentItem.category; // Assuming this is English Answer
        if (!textToSpeak) return;

        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = 'en-US';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
    };

    const playUserAudio = () => {
        if (result?.audio_url) {
            new Audio(result.audio_url).play();
        }
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.closeButton}>✕</button>
                <div className={styles.progressBarContainer}>
                    {items.map((_, idx) => (
                        <div
                            key={idx}
                            className={`${styles.progressSegment} ${idx <= currentIndex ? styles.active : ''}`}
                        />
                    ))}
                    {/* If single item mode, show full bar? */}
                    {items.length === 0 && <div className={styles.progressSegment}></div>}
                </div>
            </header>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Loading...</div>
            ) : !currentItem ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>No items found.</div>
            ) : (
                <div className={styles.contentContainer}>

                    {/* STATE 1: QUESTION (Recording/Prompt) */}
                    {!result && (
                        <>
                            <div className={styles.hiddenAnswerPlaceholder}>
                                {/* Show hints if we had them. Just boxes for now. */}
                                <div className={styles.grayBox} style={{ width: '80%' }}></div>
                                <div className={styles.grayBox} style={{ width: '60%' }}></div>
                            </div>

                            <h2 className={styles.koreanPrompt}>
                                {currentItem.situation}
                            </h2>

                            <div className={styles.footerArea}>
                                {isSubmitting ? (
                                    <div style={{ color: '#0070f3', fontWeight: 600 }}>Running...</div>
                                ) : (
                                    <AudioRecorder
                                        key={currentItem.id + (result ? 'done' : 'record')} // Remount on change
                                        onRecordingComplete={handleRecordingComplete}
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {/* STATE 2: RESULT (Answer Revealed) */}
                    {result && (
                        <>
                            <div className={styles.successIcon}>✓</div>

                            <div className={styles.englishAnswer}>
                                {currentItem.category}
                            </div>

                            <div className={styles.audioButtons}>
                                <button className={`${styles.audioBtn} ${styles.model}`} onClick={playModelAudio}>
                                    <div className={styles.iconSquare}></div>
                                    모범 발음
                                </button>
                                <button className={`${styles.audioBtn} ${styles.user}`} onClick={playUserAudio}>
                                    <span className={styles.iconPlay}>▶</span>
                                    내 발음
                                </button>
                            </div>

                            <p className={styles.koreanPrompt} style={{ marginTop: '2rem', marginBottom: '0' }}>
                                {currentItem.situation}
                            </p>

                            <div className={styles.footerArea}>
                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <button className={styles.retryButton} onClick={handleRetry}>
                                        ↺
                                    </button>
                                </div>
                                <button className={styles.nextButtonText} onClick={handleNext}>
                                    다음으로 넘어가기
                                </button>
                            </div>
                        </>
                    )}

                </div>
            )}
        </div>
    );
}
