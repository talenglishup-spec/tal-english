'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from '../../TeacherPage.module.css'; // Reuse styles

interface Attempt {
    attempt_id: string;
    player_id: string;
    date_time: string;
    situation: string;
    target_en: string;
    stt_text: string;
    ai_score: number;
    coach_score?: string;
    coach_feedback?: string;
    audio_url: string;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    // Unwrap params using React.use()
    const { id } = use(params);

    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editScore, setEditScore] = useState('');
    const [editFeedback, setEditFeedback] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'teacher')) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (id) {
            fetch(`/api/user/stats?playerId=${id}`)
            // stats API only returns summary+latest. We need FULL list.
            // Actually we can reuse /api/teacher/attempts but filter? or better specific endpoint.
            // let's use the big endpoint and filter client side for MVP simplicity.
            // Efficiency warning: creates over-fetching but simplest to code now.

            fetch('/api/teacher/attempts')
                .then(res => res.json())
                .then(data => {
                    const all: Attempt[] = data.attempts;
                    const filtered = all.filter(a => a.player_id === id);
                    // Sort descending date
                    filtered.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
                    setAttempts(filtered);
                    setLoadingData(false);
                });
        }
    }, [id]);

    const startEdit = (a: Attempt) => {
        setEditingId(a.attempt_id);
        setEditScore(a.coach_score || '');
        setEditFeedback(a.coach_feedback || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            const res = await fetch('/api/teacher/update-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attemptId: editingId,
                    coach_score: editScore,
                    coach_feedback: editFeedback
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update local list
                setAttempts(prev => prev.map(a =>
                    a.attempt_id === editingId
                        ? { ...a, coach_score: editScore, coach_feedback: editFeedback }
                        : a
                ));
                setEditingId(null);
            } else {
                alert('Failed to save');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading || loadingData) return <div style={{ padding: '2rem' }}>Loading Player Data...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', marginBottom: '1rem' }}
                >
                    ← Back
                </button>
                <h1>Player: {id}</h1>
            </header>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Situation / Target</th>
                            <th>User Audio</th>
                            <th>AI Score</th>
                            <th style={{ minWidth: '200px' }}>Coach Feedback</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attempts.map(a => (
                            <tr key={a.attempt_id}>
                                <td style={{ fontSize: '0.85rem' }}>
                                    {new Date(a.date_time).toLocaleString()}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.situation}</div>
                                    <div style={{ color: '#666', fontSize: '0.8rem' }}>{a.target_en}</div>
                                    <div style={{ color: '#0070f3', fontSize: '0.8rem', marginTop: '4px' }}>Input: "{a.stt_text}"</div>
                                </td>
                                <td>
                                    {a.audio_url && (
                                        <audio controls src={a.audio_url} style={{ height: '30px', width: '200px' }} />
                                    )}
                                </td>
                                <td>
                                    <span style={{ fontWeight: 'bold' }}>{a.ai_score}</span>
                                </td>
                                <td>
                                    {editingId === a.attempt_id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                placeholder="Score (e.g. A, B, 90)"
                                                value={editScore}
                                                onChange={e => setEditScore(e.target.value)}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                            />
                                            <textarea
                                                placeholder="Feedback..."
                                                value={editFeedback}
                                                onChange={e => setEditFeedback(e.target.value)}
                                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            {a.coach_score && (
                                                <div style={{ fontWeight: 'bold', color: '#e65100' }}>Score: {a.coach_score}</div>
                                            )}
                                            <div style={{ fontSize: '0.9rem', color: '#555' }}>{a.coach_feedback || '-'}</div>
                                        </div>
                                    )}
                                </td>
                                <td>
                                    {editingId === a.attempt_id ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={saveEdit} disabled={saving} className={styles.badgeSuccess} style={{ cursor: 'pointer', border: 'none' }}>
                                                {saving ? '...' : 'Save'}
                                            </button>
                                            <button onClick={cancelEdit} className={styles.viewBtn}>Cancel</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(a)} className={styles.viewBtn}>
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
