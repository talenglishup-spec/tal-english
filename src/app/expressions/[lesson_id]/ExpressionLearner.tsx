'use client';

import React, { useState, useRef } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import styles from './ExpressionLearner.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mode = 'view' | 'cloze' | 'speaking' | 'flashcard';

export interface Expression {
    expression_id: string;
    expression:    string;
    meaning_kr:    string;
    category:      string;
    example1:      string;
    example2:      string;
    example3:      string;
    order:         number;
}

interface Props {
    expressions: Expression[];
    mode:        Mode;
    playerId:    string;
    lessonId:    string;
    onComplete:  () => void;
    onClose:     () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createClozeText(example: string, expression: string): string {
    const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    if (!regex.test(example)) {
        return `${example} (_____)`;
    }
    return example.replace(regex, '_____');
}

function checkClozeAnswer(answer: string, expression: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return norm(answer).includes(norm(expression));
}

function playTTS(text: string, rate = 0.9) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    window.speechSynthesis.speak(u);
}

async function saveProgress(params: {
    playerId:          string;
    expressionId:      string;
    lessonId:          string;
    mode:              Mode;
    completed:         boolean;
    clozeAnswer?:      string;
    clozeScore?:       number;
    speakingCompleted?: boolean;
    audioBlob?:        Blob;
}) {
    const fd = new FormData();
    fd.append('player_id',          params.playerId);
    fd.append('expression_id',      params.expressionId);
    fd.append('lesson_id',          params.lessonId);
    fd.append('mode',               params.mode);
    fd.append('completed',          String(params.completed));
    fd.append('cloze_answer',       params.clozeAnswer       ?? '');
    fd.append('cloze_score',        String(params.clozeScore ?? 0));
    fd.append('speaking_completed', String(params.speakingCompleted ?? false));
    if (params.audioBlob) {
        fd.append('audio', params.audioBlob, 'recording.webm');
    }
    await fetch('/api/expressions/progress', { method: 'POST', body: fd });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpressionLearner({ expressions, mode, playerId, lessonId, onComplete, onClose }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const current = expressions[currentIndex];
    const total   = expressions.length;

    const handleNext = async (saveParams: Omit<Parameters<typeof saveProgress>[0], 'playerId' | 'expressionId' | 'lessonId' | 'mode'>) => {
        await saveProgress({ playerId, expressionId: current.expression_id, lessonId, mode, ...saveParams });
        if (currentIndex + 1 < total) {
            setCurrentIndex(i => i + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className={styles.page}>
            {/* Header with progress segments */}
            <header className={styles.header}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>
                <div className={styles.progressBar}>
                    {expressions.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.segment} ${i <= currentIndex ? styles.segmentActive : ''}`}
                        />
                    ))}
                </div>
            </header>

            <div className={styles.content}>
                {mode === 'view'      && <ViewMode      expr={current} onDone={() => handleNext({ completed: true })} />}
                {mode === 'cloze'     && <ClozeMode     expr={current} onDone={(ans, score) => handleNext({ completed: true, clozeAnswer: ans, clozeScore: score })} />}
                {mode === 'speaking'  && <SpeakingMode  expr={current} onDone={(blob) => handleNext({ completed: true, speakingCompleted: true, audioBlob: blob ?? undefined })} />}
                {mode === 'flashcard' && <FlashcardMode expr={current} onDone={() => handleNext({ completed: true })} />}
            </div>
        </div>
    );
}

// ─── View Mode ────────────────────────────────────────────────────────────────

function ViewMode({ expr, onDone }: { expr: Expression; onDone: () => void }) {
    const examples = [expr.example1, expr.example2, expr.example3].filter(Boolean);

    const handleListenAll = () => {
        const text = [expr.expression, ...examples].join('. ');
        playTTS(text);
    };

    return (
        <div className={styles.modeWrap}>
            <p className={styles.modeTag}>👁️ 보기</p>

            <div className={styles.expressionBlock}>
                <div className={styles.expressionText}>{expr.expression}</div>
                <div className={styles.meaningText}>{expr.meaning_kr}</div>
            </div>

            <div className={styles.examplesBlock}>
                <p className={styles.examplesLabel}>예문</p>
                {examples.map((ex, i) => (
                    <div key={i} className={styles.exampleRow}>
                        <span className={styles.exampleNum}>{i + 1}</span>
                        <span className={styles.exampleText}>{ex}</span>
                    </div>
                ))}
            </div>

            <button className={styles.ttsBtn} onClick={handleListenAll}>
                🔊 예문 듣기
            </button>

            <button className={styles.primaryBtn} onClick={onDone}>
                완료
            </button>
        </div>
    );
}

// ─── Cloze Mode ───────────────────────────────────────────────────────────────

function ClozeMode({ expr, onDone }: { expr: Expression; onDone: (answer: string, score: number) => void }) {
    const [answer,    setAnswer]    = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    const clozeText = createClozeText(expr.example1 || expr.expression, expr.expression);

    const handleSubmit = () => {
        if (!answer.trim()) return;
        const correct = checkClozeAnswer(answer, expr.expression);
        // Score: 100 if exact match, 60 if partial (admin-only)
        const score = correct ? 100 : 40;
        setIsCorrect(correct);
        setSubmitted(true);
        // Store but don't show to player
        onDone(answer, score);
    };

    return (
        <div className={styles.modeWrap}>
            <p className={styles.modeTag}>✏️ 빈칸 채우기</p>

            <div className={styles.clozePrompt}>
                {clozeText.split('_____').map((part, i, arr) => (
                    <React.Fragment key={i}>
                        <span>{part}</span>
                        {i < arr.length - 1 && <span className={styles.clozeBlank}>_____</span>}
                    </React.Fragment>
                ))}
            </div>

            {!submitted ? (
                <>
                    <input
                        className={styles.clozeInput}
                        type="text"
                        placeholder="표현을 입력해보세요"
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        autoFocus
                    />
                    <button className={styles.primaryBtn} onClick={handleSubmit} disabled={!answer.trim()}>
                        확인
                    </button>
                </>
            ) : (
                <div className={styles.clozeResult}>
                    <div className={styles.correctAnswer}>{expr.expression}</div>
                    <div className={`${styles.resultMsg} ${isCorrect ? styles.correct : styles.tryAgain}`}>
                        {isCorrect ? '잘했어요! 👍' : '한번 더 봐요 💪'}
                    </div>
                    {/* Score is intentionally NOT shown to player */}
                </div>
            )}
        </div>
    );
}

// ─── Speaking Mode ────────────────────────────────────────────────────────────

function SpeakingMode({ expr, onDone }: { expr: Expression; onDone: (blob: Blob | null) => void }) {
    const [recorded,   setRecorded]   = useState(false);
    const [audioBlob,  setAudioBlob]  = useState<Blob | null>(null);
    const [uploading,  setUploading]  = useState(false);

    const handleRecordingComplete = (blob: Blob) => {
        setAudioBlob(blob);
        setRecorded(true);
    };

    const handleDone = async () => {
        setUploading(true);
        await onDone(audioBlob);
        setUploading(false);
    };

    return (
        <div className={styles.modeWrap}>
            <p className={styles.modeTag}>🔊 따라 말하기</p>

            <div className={styles.expressionBlock}>
                <div className={styles.expressionText}>{expr.expression}</div>
                <div className={styles.meaningText}>{expr.meaning_kr}</div>
            </div>

            <button className={styles.ttsBtn} onClick={() => playTTS(expr.expression, 0.8)}>
                🔊 모범 발음 듣기
            </button>

            <p className={styles.speakingHint}>따라 말해보세요</p>

            <AudioRecorder
                key={expr.expression_id}
                onRecordingComplete={handleRecordingComplete}
            />

            {recorded && (
                <button className={styles.primaryBtn} onClick={handleDone} disabled={uploading}>
                    {uploading ? '저장 중...' : '완료 ✓'}
                </button>
            )}
        </div>
    );
}

// ─── Flashcard Mode ───────────────────────────────────────────────────────────

function FlashcardMode({ expr, onDone }: { expr: Expression; onDone: () => void }) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className={styles.modeWrap}>
            <p className={styles.modeTag}>🃏 플래시카드</p>

            <div className={`${styles.card} ${flipped ? styles.cardFlipped : ''}`} onClick={() => setFlipped(f => !f)}>
                {!flipped ? (
                    <div className={styles.cardFront}>
                        <p className={styles.cardHint}>한국어 뜻을 보고 표현을 맞혀보세요</p>
                        <div className={styles.cardMeaning}>{expr.meaning_kr}</div>
                        <p className={styles.cardTap}>탭해서 확인 →</p>
                    </div>
                ) : (
                    <div className={styles.cardBack}>
                        <div className={styles.expressionText}>{expr.expression}</div>
                        <div className={styles.meaningText}>{expr.meaning_kr}</div>
                        <button
                            className={styles.ttsSmallBtn}
                            onClick={e => { e.stopPropagation(); playTTS(expr.expression); }}
                        >
                            🔊
                        </button>
                    </div>
                )}
            </div>

            {flipped && (
                <button className={styles.primaryBtn} onClick={onDone}>
                    완료 ✓
                </button>
            )}
        </div>
    );
}
