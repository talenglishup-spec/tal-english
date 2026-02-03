'use client';

import React, { useEffect, useState } from 'react';
import styles from './AdminPage.module.css';

type Attempt = {
    attempt_id: string;
    date_time: string;
    player_name: string;
    situation: string;
    target_en: string;
    stt_text: string;
    ai_score: number;
    audio_url: string;
    coach_score: string;
    coach_feedback: string;
};

export default function AdminPage() {
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ score: string; feedback: string }>({ score: '', feedback: '' });

    const fetchAttempts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/attempts');
            const data = await res.json();
            if (data.attempts) {
                setAttempts(data.attempts);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load attempts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttempts();
    }, []);

    const handlePlayAudio = (url: string) => {
        const audio = new Audio(url);
        audio.play();
    };

    const startEdit = (attempt: Attempt) => {
        setEditingId(attempt.attempt_id);
        setEditForm({
            score: attempt.coach_score || '',
            feedback: attempt.coach_feedback || '',
        });
    };

    const handleSave = async (attemptId: string) => {
        try {
            const res = await fetch('/api/admin/attempts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attempt_id: attemptId,
                    coach_score: editForm.score,
                    coach_feedback: editForm.feedback,
                }),
            });

            if (res.ok) {
                // Update local state
                setAttempts(prev => prev.map(a =>
                    a.attempt_id === attemptId
                        ? { ...a, coach_score: editForm.score, coach_feedback: editForm.feedback }
                        : a
                ));
                setEditingId(null);
            } else {
                alert('Failed to save feedback');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving feedback');
        }
    };

    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleString();
        } catch {
            return isoString;
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Admin Dashboard</h1>
                <button onClick={fetchAttempts} className={styles.refreshButton}>Refresh</button>
            </header>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Player</th>
                            <th>Situation / Target</th>
                            <th>STT / AI Score</th>
                            <th>Audio</th>
                            <th>Coach Feedback</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                        ) : attempts.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No attempts recorded yet.</td></tr>
                        ) : (
                            attempts.map((attempt) => (
                                <tr key={attempt.attempt_id}>
                                    <td>{formatDate(attempt.date_time)}</td>
                                    <td>{attempt.player_name}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{attempt.situation}</div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9em' }}>{attempt.target_en}</div>
                                    </td>
                                    <td>
                                        <div style={{ marginBottom: '0.25rem' }}>"{attempt.stt_text}"</div>
                                        <div className={attempt.ai_score >= 80 ? styles.statusGood : styles.statusBad} style={{ fontWeight: 600 }}>
                                            AI: {attempt.ai_score}
                                        </div>
                                    </td>
                                    <td>
                                        <button className={styles.audioButton} onClick={() => handlePlayAudio(attempt.audio_url)} aria-label="Play">
                                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </button>
                                    </td>
                                    <td>
                                        {editingId === attempt.attempt_id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    placeholder="Score"
                                                    className={`${styles.input} ${styles.scoreInput}`}
                                                    value={editForm.score}
                                                    onChange={e => setEditForm({ ...editForm, score: e.target.value })}
                                                    min="0" max="100"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Feedback"
                                                    className={styles.input}
                                                    value={editForm.feedback}
                                                    onChange={e => setEditForm({ ...editForm, feedback: e.target.value })}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                {attempt.coach_score && <div><strong>Score:</strong> {attempt.coach_score}</div>}
                                                {attempt.coach_feedback && <div>{attempt.coach_feedback}</div>}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {editingId === attempt.attempt_id ? (
                                            <button className={styles.saveButton} onClick={() => handleSave(attempt.attempt_id)}>Save</button>
                                        ) : (
                                            <button
                                                className={styles.refreshButton}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                                onClick={() => startEdit(attempt)}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
