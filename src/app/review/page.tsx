'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ReviewPage.module.css';

interface Attempt {
    attempt_id: string;
    situation: string;
    date_time: string;
    ai_score: number;
    coach_feedback?: string;
    audio_url: string;
    player_id: string; // needed for filtering if fetching all
}

interface Material {
    id: string;
    date_added: string;
    title: string;
    url: string;
    type: 'video' | 'document';
    player_id: string;
}

export default function ReviewPage() {
    const { user } = useAuth(); // Get current user
    const [activeTab, setActiveTab] = useState<'history' | 'materials'>('history');

    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch History (using stats API or similar)
            // We'll reuse the logic from before, filtering for current user
            try {
                const resHistory = await fetch('/api/admin/attempts'); // or new filtered endpoint
                const dataHistory = await resHistory.json();
                if (dataHistory.attempts) {
                    // Client-side filter for current user
                    const myAttempts = dataHistory.attempts.filter((a: Attempt) =>
                        user ? a.player_id === user.id : true
                    );
                    setAttempts(myAttempts);
                }

                // 2. Fetch Materials
                const resMaterials = await fetch('/api/teacher/materials');
                const dataMaterials = await resMaterials.json();
                if (dataMaterials.materials) {
                    // Filter: 'all' OR matches user.id
                    const myMaterials = dataMaterials.materials.filter((m: Material) =>
                        m.player_id === 'all' || (user && m.player_id === user.id)
                    );
                    setMaterials(myMaterials);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user]);

    // Helper to get YouTube ID
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    if (!user) return <div className={styles.page}>Please login first.</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>📚 My Learning</h1>
            </header>

            <div className={styles.tabs} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    className={activeTab === 'history' ? styles.activeTabBtn : styles.tabBtn}
                    onClick={() => setActiveTab('history')}
                >
                    🎙️ Practice History
                </button>
                <button
                    className={activeTab === 'materials' ? styles.activeTabBtn : styles.tabBtn}
                    onClick={() => setActiveTab('materials')}
                >
                    🎥 Class Materials
                </button>
            </div>

            {activeTab === 'history' && (
                <div className={styles.list}>
                    {attempts.length === 0 ? (
                        <div className={styles.emptyState}>No practice history yet.</div>
                    ) : (
                        attempts.map(attempt => (
                            <div key={attempt.attempt_id} className={styles.itemCard}>
                                <div className={styles.scoreBox} style={{
                                    backgroundColor: attempt.ai_score >= 80 ? '#e8f5e9' : '#fff3e0',
                                    color: attempt.ai_score >= 80 ? '#2e7d32' : '#ef6c00'
                                }}>
                                    {attempt.ai_score}
                                </div>
                                <div className={styles.details}>
                                    <h3 className={styles.situation}>{attempt.situation}</h3>
                                    <p className={styles.date}>{new Date(attempt.date_time).toLocaleDateString()}</p>
                                    {attempt.coach_feedback && (
                                        <p className={styles.feedback}>💡 {attempt.coach_feedback}</p>
                                    )}
                                </div>
                                <button className={styles.playButton} onClick={() => new Audio(attempt.audio_url).play()}>
                                    ▶
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'materials' && (
                <div className={styles.grid}>
                    {materials.length === 0 ? (
                        <div className={styles.emptyState}>No class materials assigned yet.</div>
                    ) : (
                        materials.map(m => (
                            <div key={m.id} className={styles.materialCard}>
                                <div className={styles.materialHeader}>
                                    <span className={styles.materialType}>{m.type === 'video' ? 'VIDEO' : 'DOC'}</span>
                                    <span className={styles.materialDate}>{m.date_added}</span>
                                </div>
                                <h3 className={styles.materialTitle}>{m.title}</h3>

                                {m.type === 'video' && getYouTubeId(m.url) ? (
                                    <div className={styles.videoWrapper}>
                                        <iframe
                                            width="100%" height="200"
                                            src={`https://www.youtube.com/embed/${getYouTubeId(m.url)}`}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                ) : (
                                    <a href={m.url} target="_blank" className={styles.linkBtn}>
                                        Open Link ↗
                                    </a>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
