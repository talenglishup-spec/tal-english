'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './ReviewPage.module.css';

interface ReviewVideo {
    video_id: string;
    title_ko: string;
    title_en: string;
    result_context: string;
    team_context: string;
    speaker_role: string;
    level: string;
    primary_tags: string;
    youtube_url: string;
    source_notes: string;
    linked_question_ids: string;
}

interface InterviewQuestion {
    question_id: string;
    question_en: string;
    question_ko: string;
    pattern_type: string;
    primary_tags: string;
    difficulty: string;
    followup_group_id: string;
}

export default function ReviewPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [videos, setVideos] = useState<ReviewVideo[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterResult, setFilterResult] = useState<string>('');
    const [filterRole, setFilterRole] = useState<string>('');

    // Detail View
    const [selectedVideo, setSelectedVideo] = useState<ReviewVideo | null>(null);
    const [recommendedQuestions, setRecommendedQuestions] = useState<InterviewQuestion[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [includeFollowup, setIncludeFollowup] = useState(true);

    // Fetch initial list
    useEffect(() => {
        if (!user) return;
        fetchVideos();
    }, [user, filterResult, filterRole]);

    const fetchVideos = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterResult) params.set('result_context', filterResult);
            if (filterRole) params.set('speaker_role', filterRole);

            const res = await fetch(`/api/review/videos?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setVideos(data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectVideo = async (videoId: string) => {
        const video = videos.find(v => v.video_id === videoId);
        if (video) setSelectedVideo(video);

        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/review/video/${videoId}`);
            const data = await res.json();
            if (data.success) {
                setRecommendedQuestions(data.data.recommended_questions || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetail(false);
        }
    };

    const getYouTubeId = (url: string) => {
        try {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        } catch (e) { return null; }
    };

    const handleSessionLaunch = async (mode: 'assemble' | 'challenge') => {
        if (!selectedVideo) return;

        try {
            const qIds = recommendedQuestions.map(q => q.question_id);
            if (qIds.length === 0) {
                alert("No questions available for this video.");
                return;
            }

            const res = await fetch('/api/session/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    source: 'review_video',
                    video_id: selectedVideo.video_id,
                    question_ids: qIds,
                    include_followup: includeFollowup
                })
            });

            const data = await res.json();
            if (data.success) {
                router.push(data.data.redirect_url);
            } else {
                alert("Failed to launch session");
            }
        } catch (e) {
            console.error(e);
            alert("Error launching session");
        }
    };

    if (!user) return null;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.title}>Review Library</div>
                <button onClick={() => router.push('/home')} className={styles.homeBtn}>🏠 Home</button>
            </header>

            <div className={styles.content}>
                {selectedVideo ? (
                    // ---------------- DETAIL VIEW ----------------
                    <div className={styles.detailView}>
                        <button onClick={() => setSelectedVideo(null)} className={styles.backBtn}>← Back to Library</button>

                        <div className={styles.videoHeader}>
                            <h2>{selectedVideo.title_ko}</h2>
                            <p className={styles.subtitle}>{selectedVideo.title_en}</p>
                            <div className={styles.tags}>
                                {selectedVideo.result_context && <span className={styles.tagContext}>{selectedVideo.result_context.toUpperCase()}</span>}
                                {selectedVideo.speaker_role && <span className={styles.tagRole}>{selectedVideo.speaker_role}</span>}
                            </div>
                        </div>

                        {getYouTubeId(selectedVideo.youtube_url) && (
                            <div className={styles.videoPlayer}>
                                <iframe
                                    width="100%" height="100%"
                                    src={`https://www.youtube.com/embed/${getYouTubeId(selectedVideo.youtube_url)}`}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        )}

                        <div className={styles.analysisSection}>
                            <h3>Recommended Questions</h3>

                            {loadingDetail ? (
                                <p className={styles.loadingText}>Loading questions...</p>
                            ) : (
                                <div className={styles.questionList}>
                                    {recommendedQuestions.length > 0 ? recommendedQuestions.map((q, idx) => (
                                        <div key={q.question_id} className={styles.questionItem}>
                                            <div className={styles.qNum}>Q{idx + 1}</div>
                                            <div className={styles.qText}>
                                                <div className={styles.qEn}>{q.question_en}</div>
                                                <div className={styles.qKo}>{q.question_ko}</div>
                                                <div className={styles.qMeta}>
                                                    <span className={styles.qType}>{q.pattern_type}</span>
                                                    {q.followup_group_id && <span className={styles.qFollow}>+ Follow-up</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className={styles.loadingText}>No recommended questions found.</p>
                                    )}
                                </div>
                            )}

                            <div className={styles.actionPanel}>
                                <div className={styles.actionHeader}>
                                    <h3>Start Training</h3>
                                    <label className={styles.toggleWrap}>
                                        <input
                                            type="checkbox"
                                            checked={includeFollowup}
                                            onChange={(e) => setIncludeFollowup(e.target.checked)}
                                        />
                                        Include Follow-up Questions
                                    </label>
                                </div>

                                <div className={styles.btnGroup}>
                                    <button
                                        className={styles.assembleBtn}
                                        onClick={() => handleSessionLaunch('assemble')}
                                        disabled={recommendedQuestions.length === 0}
                                    >
                                        <div className={styles.btnIcon}>🧩</div>
                                        <div className={styles.btnText}>
                                            <strong>Assemble</strong>
                                            <span>Practice structure (2 Qs)</span>
                                        </div>
                                    </button>

                                    <button
                                        className={styles.challengeBtn}
                                        onClick={() => handleSessionLaunch('challenge')}
                                        disabled={recommendedQuestions.length === 0}
                                    >
                                        <div className={styles.btnIcon}>🔥</div>
                                        <div className={styles.btnText}>
                                            <strong>Challenge</strong>
                                            <span>Random Q + Pressure</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // ---------------- LIST VIEW ----------------
                    <div className={styles.listView}>
                        <div className={styles.filters}>
                            <div className={styles.filterGroup}>
                                <label>Result:</label>
                                <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                                    <option value="">All Contexts</option>
                                    <option value="win">Win / Victory</option>
                                    <option value="loss">Loss / Defeat</option>
                                    <option value="draw">Draw</option>
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className={styles.loadingText}>Loading library...</div>
                        ) : videos.length > 0 ? (
                            <div className={styles.videoGrid}>
                                {videos.map(v => {
                                    const ytid = getYouTubeId(v.youtube_url);
                                    const thumbUrl = ytid ? `https://img.youtube.com/vi/${ytid}/mqdefault.jpg` : '/placeholder-video.jpg';

                                    return (
                                        <div key={v.video_id} className={styles.videoCard} onClick={() => handleSelectVideo(v.video_id)}>
                                            <div className={styles.thumbWrap}>
                                                <img src={thumbUrl} alt="Thumbnail" className={styles.thumbnail} />
                                                <div className={styles.playIcon}>▶</div>
                                                {v.result_context && (
                                                    <div className={`${styles.badge} ${styles['badge_' + v.result_context.toLowerCase()]}`}>
                                                        {v.result_context.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={styles.cardInfo}>
                                                <h4>{v.title_ko}</h4>
                                                <p className={styles.cardExt}>{v.team_context} • {v.speaker_role}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No videos found matching filters.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
