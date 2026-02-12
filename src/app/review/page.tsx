'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ReviewPage.module.css';

// Types
interface Lesson {
    lesson_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
}

interface TrainingItem {
    id: string;
    situation: string;
    category: string;
    level: string;
    target_en: string;
}

interface Material {
    material_id: string;
    title: string;
    url: string;
    type: 'video' | 'doc' | 'link';
    note: string;
}

export default function ReviewPage() {
    const { user, logout } = useAuth();

    // Lessons State
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loadingLessons, setLoadingLessons] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    // Detail State
    const [lessonMaterials, setLessonMaterials] = useState<Material[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch Lessons on mount
    useEffect(() => {
        if (!user) return;

        async function fetchLessons() {
            try {
                const res = await fetch(`/api/train/lessons?playerId=${user?.id}`);
                const data = await res.json();
                if (data.lessons) setLessons(data.lessons);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingLessons(false);
            }
        }
        fetchLessons();
    }, [user]);

    // Fetch Details when a lesson is selected
    useEffect(() => {
        if (!selectedLesson) return;

        async function fetchDetails() {
            setLoadingDetails(true);
            try {
                // Fetch Materials (Content)
                const materialsRes = await fetch(`/api/train/materials?lessonId=${selectedLesson?.lesson_id}`);
                const materialsData = await materialsRes.json();
                if (materialsData.materials) setLessonMaterials(materialsData.materials);

            } catch (e) {
                console.error(e);
            } finally {
                setLoadingDetails(false);
            }
        }
        fetchDetails();
    }, [selectedLesson]);

    // Helper to get YouTube ID
    const getYouTubeId = (url: string) => {
        try {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        } catch (e) { return null; }
    };

    const handleBack = () => {
        setSelectedLesson(null);
        setLessonMaterials([]);
    };

    if (!user) return null;

    return (
        <div className={styles.page}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={styles.title}>수업리뷰</div>
                <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                    🚪
                </button>
            </header>

            <div className={styles.content}>
                {selectedLesson ? (
                    // Detail View
                    <div className={styles.detailView}>
                        <button onClick={handleBack} className={styles.backBtn}>← 목록으로 돌아가기</button>

                        <div className={styles.lessonInfo}>
                            <h2>Lesson {selectedLesson.lesson_no} – {selectedLesson.note}</h2>
                            <p className={styles.date}>{selectedLesson.lesson_date}</p>
                        </div>

                        {loadingDetails ? (
                            <p>Loading details...</p>
                        ) : (
                            <>
                                {/* SECTION 1: MATERIALS */}
                                {lessonMaterials.length > 0 ? (
                                    <div className={styles.section}>
                                        <h3>Class Materials</h3>
                                        <div className={styles.grid}>
                                            {lessonMaterials.map(m => (
                                                <div key={m.material_id} className={styles.materialCard}>
                                                    <div className={styles.materialHeader}>
                                                        <span className={styles.materialType}>{m.type.toUpperCase()}</span>
                                                        <span className={styles.materialDate}>{m.title}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                                                        Lesson {selectedLesson.lesson_no}
                                                    </div>
                                                    {m.note && <p className={styles.materialNote}>{m.note}</p>}

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
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                                        수업 자료가 없습니다.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    // List View
                    <div className={styles.lessonList}>
                        {loadingLessons ? (
                            <p style={{ textAlign: 'center', color: '#666' }}>수업 목록을 불러오는 중...</p>
                        ) : lessons.length > 0 ? (
                            lessons.map(lesson => (
                                <div
                                    key={lesson.lesson_id}
                                    className={styles.lessonRow}
                                    onClick={() => setSelectedLesson(lesson)}
                                >
                                    <div className={styles.lessonIcon}>📅</div>
                                    <div className={styles.lessonDetails}>
                                        <h3>Lesson {lesson.lesson_no} – {lesson.note}</h3>
                                        <p>{lesson.lesson_date}</p>
                                    </div>
                                    <div className={styles.arrow}>›</div>
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                                완료된 수업이 없습니다.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
