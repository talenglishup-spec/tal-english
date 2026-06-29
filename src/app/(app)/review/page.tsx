'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './ReviewPage.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Material {
    id: string;
    date_added: string;
    title: string;
    url: string;
    type: 'video' | 'document';
    player_id: string;
}

interface LessonProgress {
    lesson_id:       string;
    lesson_no:       number;
    lesson_title_ko: string;
    lesson_type:     string;
    lesson_date:     string;
}

interface ExpressionSummary {
    lesson_id:        string;
    expression_count: number;
    completed_count:  number;
}

type ReviewTab      = 'videos' | 'expressions';
type ExpressionView = 'lesson' | 'category';
type Category       = 'on-pitch' | 'interview' | 'life';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
    { key: 'on-pitch',  label: 'On-Pitch',  icon: '⚽' },
    { key: 'interview', label: 'Interview', icon: '🎙️' },
    { key: 'life',      label: 'Life',      icon: '🌱' },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
    const { user } = useAuth();
    const router   = useRouter();

    const [activeTab, setActiveTab] = useState<ReviewTab>('videos');

    // ── Videos ────────────────────────────────────────────────────────────
    const [materials,  setMaterials]  = useState<Material[]>([]);
    const [matLoading, setMatLoading] = useState(true);

    // ── Expressions ───────────────────────────────────────────────────────
    const [exprView,       setExprView]       = useState<ExpressionView>('lesson');
    const [lessons,        setLessons]        = useState<LessonProgress[]>([]);
    const [exprSummaries,  setExprSummaries]  = useState<ExpressionSummary[]>([]);
    const [categoryExprs,  setCategoryExprs]  = useState<Record<Category, any[]>>({
        'on-pitch': [], interview: [], life: [],
    });
    const [activeCategory, setActiveCategory] = useState<Category>('on-pitch');
    const [exprLoading,    setExprLoading]    = useState(false);

    // ── Fetch materials ───────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const res  = await fetch('/api/teacher/materials');
                const data = await res.json();
                if (data.materials) {
                    setMaterials(
                        data.materials.filter((m: Material) =>
                            m.player_id === 'all' || m.player_id === user.id
                        )
                    );
                }
            } catch (e) { console.error(e); }
            finally { setMatLoading(false); }
        })();
    }, [user]);

    // ── Fetch expression lesson summaries ─────────────────────────────────
    useEffect(() => {
        if (!user || activeTab !== 'expressions') return;
        (async () => {
            setExprLoading(true);
            try {
                const [lessonRes, lessonIdsRes, progressRes] = await Promise.all([
                    fetch(`/api/review/lessons?playerId=${user.id}`),
                    fetch('/api/expressions?allLessons=true'),
                    fetch(`/api/expressions/progress?playerId=${user.id}`),
                ]);
                const [lessonData, lessonIdsData, progressData] = await Promise.all([
                    lessonRes.json(), lessonIdsRes.json(), progressRes.json(),
                ]);

                if (lessonData.success) setLessons(lessonData.lessons ?? []);

                const lessonIds: string[]  = lessonIdsData.lessonIds ?? [];
                const progressList: any[]  = progressData.progress   ?? [];

                const summaries: ExpressionSummary[] = await Promise.all(
                    lessonIds.map(async (lid) => {
                        const r    = await fetch(`/api/expressions?lessonId=${lid}`);
                        const d    = await r.json();
                        const all: any[] = d.expressions ?? [];
                        const done = new Set(
                            progressList
                                .filter((p: any) => p.lesson_id === lid && p.completed)
                                .map((p: any) => p.expression_id)
                        );
                        return { lesson_id: lid, expression_count: all.length, completed_count: done.size };
                    })
                );
                setExprSummaries(summaries);
            } catch (e) { console.error(e); }
            finally { setExprLoading(false); }
        })();
    }, [user, activeTab]);

    // ── Load one category ─────────────────────────────────────────────────
    const loadCategory = async (cat: Category) => {
        setActiveCategory(cat);
        if (categoryExprs[cat].length) return;
        try {
            const [exprRes, progressRes] = await Promise.all([
                fetch(`/api/expressions?category=${cat}`),
                fetch(`/api/expressions/progress?playerId=${user!.id}`),
            ]);
            const [exprData, progressData] = await Promise.all([exprRes.json(), progressRes.json()]);
            const done = new Set(
                (progressData.progress ?? []).filter((p: any) => p.completed).map((p: any) => p.expression_id)
            );
            const enriched = (exprData.expressions ?? []).map((e: any) => ({
                ...e, isCompleted: done.has(e.expression_id),
            }));
            setCategoryExprs(prev => ({ ...prev, [cat]: enriched }));
        } catch (e) { console.error(e); }
    };

    const getYouTubeId = (url: string) => {
        const m = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^#&?]{11})/);
        return m ? m[1] : null;
    };

    if (!user) return <div className={styles.page}>Please login first.</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>📚 My Learning</h1>
            </header>

            {/* Tab bar */}
            <div className={styles.tabs} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                    className={activeTab === 'videos' ? styles.activeTabBtn : styles.tabBtn}
                    onClick={() => setActiveTab('videos')}
                >
                    🎥 레슨별 영상
                </button>
                <button
                    className={activeTab === 'expressions' ? styles.activeTabBtn : styles.tabBtn}
                    onClick={() => setActiveTab('expressions')}
                >
                    📌 오늘의 표현
                </button>
            </div>

            {/* ── Videos ──────────────────────────────────────────────────── */}
            {activeTab === 'videos' && (
                <div className={styles.grid}>
                    {matLoading ? (
                        <div className={styles.emptyState}>Loading...</div>
                    ) : materials.length === 0 ? (
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
                                            style={{ border: 'none' }}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                ) : (
                                    <a href={m.url} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                                        Open Link ↗
                                    </a>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Expressions ─────────────────────────────────────────────── */}
            {activeTab === 'expressions' && (
                <div className={styles.list}>
                    {/* Lesson / Category toggle */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        {(['lesson', 'category'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setExprView(v)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    borderRadius: '20px',
                                    border: '1px solid',
                                    borderColor: exprView === v ? '#2962ff' : '#ddd',
                                    background:  exprView === v ? '#2962ff' : '#fff',
                                    color:       exprView === v ? '#fff'    : '#666',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                }}
                            >
                                {v === 'lesson' ? '레슨별' : '누적 관리'}
                            </button>
                        ))}
                    </div>

                    {exprLoading && <div className={styles.emptyState}>Loading...</div>}

                    {/* Lesson view */}
                    {!exprLoading && exprView === 'lesson' && (
                        exprSummaries.length === 0 ? (
                            <div className={styles.emptyState}>등록된 표현이 없습니다.</div>
                        ) : (
                            exprSummaries.map(s => {
                                const lesson  = lessons.find(l => l.lesson_id === s.lesson_id);
                                const pct     = s.expression_count > 0
                                    ? Math.round((s.completed_count / s.expression_count) * 100)
                                    : 0;
                                const allDone = s.completed_count >= s.expression_count && s.expression_count > 0;
                                return (
                                    <div
                                        key={s.lesson_id}
                                        className={styles.itemCard}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => router.push(`/expressions/${s.lesson_id}`)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#888' }}>
                                                {lesson ? `L${lesson.lesson_no} · ${lesson.lesson_date}` : s.lesson_id}
                                            </span>
                                            {allDone && <span style={{ fontSize: '0.8rem', color: '#2e7d32' }}>✅ 완료</span>}
                                        </div>
                                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#1a1a2e' }}>
                                            {lesson?.lesson_title_ko || s.lesson_id}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                                            <span>{pct}%</span>
                                            <span>{s.completed_count} / {s.expression_count}</span>
                                        </div>
                                        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2e7d32' : '#2962ff', borderRadius: 3, transition: 'width 0.3s' }} />
                                        </div>
                                    </div>
                                );
                            })
                        )
                    )}

                    {/* Category view */}
                    {!exprLoading && exprView === 'category' && (
                        <>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                {CATEGORIES.map(c => (
                                    <button
                                        key={c.key}
                                        onClick={() => loadCategory(c.key)}
                                        style={{
                                            padding: '0.4rem 1rem',
                                            borderRadius: '20px',
                                            border: '1px solid',
                                            borderColor: activeCategory === c.key ? '#2962ff' : '#ddd',
                                            background:  activeCategory === c.key ? '#2962ff' : '#fff',
                                            color:       activeCategory === c.key ? '#fff'    : '#666',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        {c.icon} {c.label}
                                    </button>
                                ))}
                            </div>

                            {categoryExprs[activeCategory].length === 0 ? (
                                <div className={styles.emptyState}>이 카테고리에 표현이 없습니다.</div>
                            ) : (
                                categoryExprs[activeCategory].map((e: any) => (
                                    <div
                                        key={e.expression_id}
                                        className={styles.itemCard}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => router.push(`/expressions/${e.lesson_id}`)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: '1rem' }}>{e.expression}</span>
                                            {e.isCompleted && <span>✅</span>}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.2rem' }}>{e.meaning_kr}</div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
