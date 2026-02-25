'use client';

import React, { useState, useEffect, useRef } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import styles from './OnPitchReactor.module.css';

interface TrainingItem {
    id: string;
    prompt_kr: string;
    target_en: string;
    category: string;
    expected_phrases?: string;
    max_latency_ms?: number;
    challenge_type?: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';
}

interface OnPitchReactorProps {
    item: TrainingItem;
    onNext: () => void;
    onClose: () => void;
    sessionId: string;
    mode?: 'practice' | 'challenge';
}

export default function OnPitchReactor({ item, onNext, onClose, sessionId, mode = 'practice' }: OnPitchReactorProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string; latency_ms?: number; audio_url?: string; stt_text?: string } | null>(null);
    const [msg, setMsg] = useState('상황을 읽고 바로 소리내어 영어로 말하세요!');
    const [strobeState, setStrobeState] = useState<'idle' | 'active' | 'analyzing' | 'done' | 'failed'>('idle');
    const initTime = useRef<number>(Date.now());
    const latencyRef = useRef<number>(0);

    const [attemptId, setAttemptId] = useState<string>('');
    const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
    const [savedDuration, setSavedDuration] = useState<number>(0);

    // Reset on new item
    useEffect(() => {
        setResult(null);
        setIsSubmitting(false);
        setStrobeState('active');
        setMsg('상황을 읽고 바로 소리내어 영어로 말하세요!');
        initTime.current = Date.now();
        setAttemptId(uuidv4());
        setSavedBlob(null);

        if (item.prompt_kr) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(item.prompt_kr);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.1; // Slightly faster for On-Pitch urgency
            window.speechSynthesis.speak(utterance);
        }
    }, [item]);

    const submitAttempt = async (blob: Blob, duration_sec: number, currentAttemptId: string) => {
        setStrobeState('analyzing');
        setIsSubmitting(true);
        setMsg('빠르게 분석 중...');

        const formData = new FormData();

        formData.append('file', blob, 'recording.webm');
        formData.append('attempt_id', currentAttemptId);
        formData.append('item_id', item.id);
        formData.append('target_en', item.target_en || '');
        formData.append('category', 'onpitch');
        formData.append('expected_phrases', item.expected_phrases || '');
        formData.append('max_latency_ms', item.max_latency_ms?.toString() || '1500');

        formData.append('session_id', sessionId);
        formData.append('session_mode', mode);
        formData.append('challenge_type', item.challenge_type || 'FOOTBALL_KO_TO_EN');
        formData.append('duration_sec', duration_sec.toString());
        formData.append('time_to_first_response_ms', latencyRef.current.toString());

        if (user) {
            formData.append('player_id', user.id);
            formData.append('player_name', user.name);
        }

        try {
            const res = await fetch('/api/process-attempt', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok && data.success) {
                setResult(data.data);
                setStrobeState('done');
                setMsg('저장됨!');
            } else {
                setMsg(data.error || '서버 저장 중 오류 발생');
                setStrobeState('failed');
            }
        } catch (e) {
            console.error(e);
            setMsg('네트워크 전송 실패');
            setStrobeState('failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRecordingComplete = async (blob: Blob, duration_sec: number) => {
        latencyRef.current = Date.now() - initTime.current;
        setSavedBlob(blob);
        setSavedDuration(duration_sec);
        submitAttempt(blob, duration_sec, attemptId);
    };

    const handleRetrySubmission = () => {
        if (savedBlob) {
            submitAttempt(savedBlob, savedDuration, attemptId);
        }
    };

    // Cleanup speech synthesis bounds
    useEffect(() => {
        return () => window.speechSynthesis.cancel();
    }, []);

    const handleRetry = () => {
        setStrobeState('active');
        setResult(null);
        setAttemptId(uuidv4());
        setSavedBlob(null);
        setMsg('다시 시도! 바로 말씀하세요!');
        initTime.current = Date.now();
        if (item.prompt_kr) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(item.prompt_kr);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    // Score Color Helper
    const getScoreFeedback = (score: number) => {
        if (score >= 90) return { label: 'Good!', className: styles.scorePerfect };
        if (score >= 70) return { label: 'Not Bad', className: styles.scoreGood };
        return { label: 'Try Again', className: styles.scoreBad };
    };

    return (
        <div className={styles.container}>
            <div className={styles.topBar}>
                <div className={styles.modeIndicator}>On-Pitch Reactor ⚡</div>
                <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>

            <main className={styles.mainCard}>
                <div className={`${styles.strobeBox} ${styles[strobeState]}`}>
                    <div className={styles.promptKo}>{item.prompt_kr}</div>
                </div>

                <div className={styles.msgText}>{msg}</div>

                {/* Recorder Area */}
                {!result && !isSubmitting && (
                    <div className={styles.micArea}>
                        <AudioRecorder
                            onRecordingComplete={handleRecordingComplete}
                            silenceDuration={500}
                            autoStop={true}
                            minVolume={4}
                        />
                    </div>
                )}

                {/* Result Processing Indicator */}
                {isSubmitting && <div className={styles.msgText}>상황 인지능력 및 속도 판정 중...</div>}

                {/* Failed Submission State */}
                {strobeState === 'failed' && (
                    <div className={styles.resultBox} style={{ borderColor: 'red' }}>
                        <div className={styles.msgText} style={{ color: 'red' }}>{msg}</div>
                        <button type="button" className={styles.nextBtn} onClick={handleRetrySubmission}>
                            업로드 재시도
                        </button>
                        <button type="button" className={styles.retryBtn} onClick={handleRetry} style={{ marginTop: '1rem' }}>
                            ↻ 다시 녹음하기
                        </button>
                    </div>
                )}

                {/* Results Screen */}
                {result && strobeState === 'done' && (
                    <div className={styles.resultBox}>
                        <div className={styles.scoreRow}>
                            <span className={styles.scoreLabel}>반응 결과</span>
                            <span className={`${styles.scoreValue} ${getScoreFeedback(result.score).className}`}>
                                {getScoreFeedback(result.score).label}
                            </span>
                        </div>
                        <div className={styles.feedbackText}>{result.feedback}</div>

                        <div className={styles.targetEn}>🗣️ {item.target_en}</div>

                        {result.latency_ms !== undefined && (
                            <div className={styles.latencyText}>
                                실제 반응 시간: {(result.latency_ms / 1000).toFixed(2)}초
                            </div>
                        )}

                        <button type="button" className={styles.nextBtn} onClick={onNext}>
                            다음 상황 ⚡
                        </button>
                        <button type="button" className={styles.retryBtn} onClick={handleRetry}>
                            ↻ 다시 연습하기
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
