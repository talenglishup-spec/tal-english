'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './ClipDetail.module.css';

interface ClipDetail {
    clip_id: string;
    title_ko: string;
    context_tag: string;
    player_name: string;
    video_url: string;
    key_lines_en: string[];
    key_lines_ko: string[];
    tags: string[];
    notes: string;
}

export default function ClipDetailPage() {
    const { clip_id } = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [clip, setClip] = useState<ClipDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchClip() {
            if (!user || !clip_id) return;
            try {
                const res = await fetch(`/api/player/clip-detail?clip_id=${clip_id}`);
                const data = await res.json();
                if (data.success && data.clip) {
                    setClip(data.clip);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchClip();
    }, [clip_id, user]);

    if (loading) {
        return <div className={styles.loading}>Loading clip...</div>;
    }

    if (!clip) {
        return (
            <div className={styles.error}>
                <h2>Clip not found</h2>
                <button onClick={() => router.back()} className={styles.backBtn}>Go Back</button>
            </div>
        );
    }

    // Convert youtube URL to embed format if needed
    const getEmbedUrl = (url: string) => {
        try {
            if (url.includes('youtube.com/watch') || url.includes('youtu.be')) {
                const videoId = url.includes('youtu.be')
                    ? url.split('youtu.be/')[1].split('?')[0]
                    : new URL(url).searchParams.get('v');
                return `https://www.youtube.com/embed/${videoId}`;
            }
        } catch {
            return url;
        }
        return url;
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.backBtn}>←</button>
                <div className={styles.tag}>{clip.context_tag}</div>
            </header>

            <div className={styles.videoContainer}>
                {clip.video_url.includes('youtube') || clip.video_url.includes('youtu.be') ? (
                    <iframe
                        className={styles.videoPlayer}
                        src={getEmbedUrl(clip.video_url)}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                ) : (
                    <video className={styles.videoPlayer} src={clip.video_url} controls playsInline></video>
                )}
            </div>

            <div className={styles.content}>
                <h1 className={styles.title}>{clip.title_ko}</h1>
                <p className={styles.player}>{clip.player_name}</p>

                {clip.tags && clip.tags.length > 0 && (
                    <div className={styles.tagsContainer}>
                        {clip.tags.map((tag, i) => (
                            <span key={i} className={styles.tagItem}>#{tag}</span>
                        ))}
                    </div>
                )}

                <div className={styles.scriptSection}>
                    <h2>주요 표현 (Key Lines)</h2>
                    {clip.key_lines_en.length > 0 ? (
                        <div className={styles.linesList}>
                            {clip.key_lines_en.map((en, idx) => (
                                <div key={idx} className={styles.lineBox}>
                                    <p className={styles.enLine}>{en}</p>
                                    {clip.key_lines_ko[idx] && (
                                        <p className={styles.koLine}>{clip.key_lines_ko[idx]}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.noLines}>등록된 주요 표현이 없습니다.</p>
                    )}
                </div>

                {clip.notes && (
                    <div className={styles.notesSection}>
                        <h2>Coach Note</h2>
                        <p>{clip.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
