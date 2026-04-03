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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [userAudioBlobUrl, setUserAudioBlobUrl] = useState<string | null>(null);
    const [isHintRevealed, setIsHintRevealed] = useState(false);
    const audioRecorderRef = useRef<any>(null);

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

    const rawType = (item.practice_type || 'A').toString().trim().toUpperCase();
    let type: string = rawType;
    if (rawType === 'A' || rawType.includes('3')) type = '3-STEP';
    else if (rawType === 'B' || rawType.includes('CLOZE')) type = '1-STEP-CLOZE';
    else if (rawType === 'C' || rawType.includes('BLANK')) type = '1-STEP-BLANK';
    else type = '3-STEP';

    if (item?.category?.toLowerCase() === 'onpitch') {
        type = '1-STEP-BLANK';
    }

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
        setShowTranslation(false);
        setRecordingTime(0);
        setUserAudioBlobUrl(null);
        setIsHintRevealed(false);

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
        }

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [item, mode, isEnType]);

    const playAudio = (url?: string) => {
        if (!url) return;
        const audio = new Audio(url);
        audio.play().catch(err => {
            console.error("Audio playback failed:", err);
            alert("오디오 재생에 실패했습니다. (Network or CORS issue)");
        });
    };

    const playQuestionAudio = () => {
        let audioUrl = item.question_audio_url || item.question_audio_en;
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

    const handleRecordingComplete = async (blob: Blob, duration_sec: number) => {
        setIsSubmitting(true);
        setMsg('Processing...');
        
        // Save local blob URL for robust playback
        const localUrl = URL.createObjectURL(blob);
        setUserAudioBlobUrl(localUrl);

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
                        {[1, 2, 3, 4, 5].map((i) => {
                            // Map subStep (1, 2, 3) to progress (e.g., 3-STEP might be 1, 3, 5)
                            // or just use subStep if simple. Let's assume subStep is the direct measure.
                            return (
                                <div key={i} className={`${styles.progressDot} ${i <= subStep ? styles.active : ''}`}></div>
                            );
                        })}
                    </div>
                    <div className={styles.modeIndicator}>
                        {mode === 'practice' ? '연습' : '챌린지'}
                    </div>
                </div>
            )}

            <div className={styles.content}>
                <div className={styles.card}>
                <div className={styles.stepBadge}>
                    STEP {subStep} / {type === '3-STEP' ? '3' : '1'}
                </div>

                {/* Status Indicator */}
                {!result && !isSubmitting && <div className={styles.questionText}>{msg}</div>}

                {/* Target or Blank Text */}
                <div className={styles.targetText}>
                    {(() => {
                        const isClozeStep = (type === '3-STEP' && subStep === 2) || type === '1-STEP-CLOZE';
                        const isBlankStep = (type === '3-STEP' && subStep === 3) || type === '1-STEP-BLANK' || mode === 'challenge';

                        if (result || answerRevealed) {
                            return <span className={styles.targetTextNormal}>{item.target_en}</span>;
                        }

                        if (isBlankStep) {
                            return (
                                <span 
                                    className={`${styles.targetTextBlankFull} ${isHintRevealed ? styles.revealed : ''}`} 
                                    aria-hidden="true"
                                    onClick={() => setIsHintRevealed(!isHintRevealed)}
                                >
                                    {item.target_en}
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

                        return <span className={styles.targetTextStep1}>{item.target_en}</span>;
                    })()}
                </div>

                <div className={styles.smallKoreanTranslation}>
                    {item.prompt_kr}
                </div>

                {(!result && !isSubmitting) && (
                    <>
                        {(item.question_text || item.matched_question_text) && (
                            <>
                                <button className={styles.actionBtn} onClick={() => setShowTranslation(!showTranslation)}>
                                    {showTranslation ? '질문 숨기기 ▲' : '질문 보기 ▼'}
                                </button>

                                {showTranslation && (
                                    <div className={styles.koreanPrompt}>
                                        {item.question_text || item.matched_question_text}
                                    </div>
                                )}
                            </>
                        )}

                        {(item.question_audio_en || item.question_audio_url || item.question_text || item.matched_question_text) && (
                            <button className={styles.listenBtnMinimal} onClick={playQuestionAudio}>
                                🔊 질문 듣기
                            </button>
                        )}
                    </>
                )}

                {/* Loading State */}
                {isSubmitting && (
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <div className={styles.loadingText}>빠르게 분석 중입니다...</div>
                    </div>
                )}



                <div className={styles.footerArea}>

                    {/* Audio Buttons in Result */}
                    {result && (
                        <div className={styles.audioButtons}>
                            {item.model_audio_url && (
                                <button type="button" onClick={() => playAudio(item.model_audio_url)} className={styles.audioBtn} style={{ cursor: 'pointer' }}>
                                    🔊 모범 발음
                                </button>
                            )}
                            {(userAudioBlobUrl || result?.audio_url) && (
                                <button type="button" onClick={() => playAudio(userAudioBlobUrl || result?.audio_url)} className={styles.audioBtn} style={{ cursor: 'pointer', marginLeft: '8px' }}>
                                    ▶️ 내 발음
                                </button>
                            )}
                        </div>
                    )}

                    {/* Recorder Area */}
                    {!result && !isSubmitting && (
                        <>
                            <AudioRecorder
                                ref={audioRecorderRef}
                                minimal={true}
                                key={`${item.id}-${subStep}`}
                                onRecordingComplete={handleRecordingComplete}
                                onStateChange={setIsRecording}
                                onTimeUpdate={setRecordingTime}
                                silenceDuration={600}
                                autoStop={false}
                            />
                            <button 
                                className={`${styles.micButtonLarge} ${isRecording ? styles.recording : ''}`}
                                onClick={() => {
                                    if (isRecording) {
                                        audioRecorderRef.current?.stopRecording();
                                    } else {
                                        audioRecorderRef.current?.startRecording();
                                    }
                                }}
                            >
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            </button>
                            {isRecording ? (
                                <span className={styles.stopwatchText}>
                                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                </span>
                            ) : (
                                <span className={styles.micLabel}>눌러서 말하기</span>
                            )}
                        </>
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
        </div>
    );
}
