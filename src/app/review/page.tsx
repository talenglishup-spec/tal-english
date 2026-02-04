'use client';

import React, { useState, useEffect } from 'react';
import styles from './ReviewPage.module.css';

interface Attempt {
    attempt_id: string;
    situation: string;
    date_time: string;
    ai_score: number;
    coach_feedback?: string;
    audio_url: string;
}

export default function ReviewPage() {
    const [attempts, setAttempts] = useState<Attempt[]>([]);

    // MVP: Reusing the admin API or creating a user-specific one?
    // Let's use /api/user/stats effectively or just fetch all attempts and filter
    // ideally proper endpoint like /api/user/attempts
    // For now we will fetch from the same source. 
    // Wait, we don't have a dedicated "my attempts" route yet besides Admin.
    // Let's create a quick client-side fetch helper or just use the admin endpoint if it's public (it is)
    // but filtered by 'demo_player'

    useEffect(() => {
        // We will repurpose user/stats or similar? No, let's just make a new simple route or use admin route with filter.
        // Actually, let's just create a new API route /api/user/history for cleanliness in next step if needed.
        // For now, let's mock or use existing. 
        // Let's assume we maintain simplicity and use the same Sheet get logic.

        // TEMPORARY: using admin-like fetch but filtering
        fetch('/api/admin/attempts')
            .then(res => res.json())
            .then(data => {
                if (data.attempts) {
                    setAttempts(data.attempts); // Filter by player_id logic here if multi-user
                }
            });
    }, []);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Review History</h1>
            </header>

            <div className={styles.list}>
                {attempts.map(attempt => (
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
                ))}

                {attempts.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                        No history yet. Start practicing!
                    </div>
                )}
            </div>
        </div>
    );
}
