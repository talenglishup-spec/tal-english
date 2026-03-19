'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './ClipsPage.module.css';
import BottomNav from '@/components/BottomNav';

interface Clip {
    clip_id: string;
    title_ko: string;
    context_tag: string;
    player_name: string;
    duration: number | null;
}

const TABS = ['All', 'Interview', 'Match', 'Tactical'];

export default function ClipsPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('All');
    const [clips, setClips] = useState<Clip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchClips() {
            if (!user) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/player/clips?player_id=${user.id}&context_tag=${activeTab}`);
                const data = await res.json();
                if (data.success) {
                    setClips(data.clips || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchClips();
    }, [user, activeTab]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.title}>Clips</div>
                    <button onClick={logout} className={styles.logoutBtn}>🚪</button>
                </div>
                <p className={styles.subtitle}>실제 인터뷰와 매치 영상을 보며 몰입도를 높이세요.</p>

                <div className={styles.tabsScroll}>
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            <div className={styles.content}>
                {loading ? (
                    <div className={styles.loading}>영상을 불러오는 중...</div>
                ) : clips.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🎬</div>
                        <p>해당 카테고리에 영상이 없습니다.</p>
                    </div>
                ) : (
                    <div className={styles.clipsGrid}>
                        {clips.map((clip) => (
                            <div
                                key={clip.clip_id}
                                className={styles.clipCard}
                                onClick={() => router.push(`/clips/${clip.clip_id}`)}
                            >
                                <div className={styles.clipThumbnail}>
                                    <div className={styles.playIcon}>▶</div>
                                    {clip.duration && <span className={styles.duration}>{Math.floor(clip.duration / 60)}:{String(clip.duration % 60).padStart(2, '0')}</span>}
                                </div>
                                <div className={styles.clipInfo}>
                                    <span className={styles.clipTag}>{clip.context_tag || 'Clip'}</span>
                                    <h3 className={styles.clipTitle}>{clip.title_ko}</h3>
                                    <p className={styles.clipPlayer}>{clip.player_name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
