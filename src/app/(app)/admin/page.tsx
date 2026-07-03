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

type ExprRecord = {
    expression_id:      string;
    expression:         string;
    meaning_kr:         string;
    category:           string;
    mode:               string;
    completed:          boolean;
    cloze_score:        number;
    cloze_answer:       string;
    speaking_completed: boolean;
    speaking_audio_url: string;
    completed_at:       string;
};

type PlayerExprSummary = {
    player_id:       string;
    records:         ExprRecord[];
    completion_rate: number;
};

type AdminTab = 'players' | 'attempts' | 'expressions';

type PlayerRow = {
    player_id: string;
    email: string;
    display_name: string;
    level: number;
    xp: number;
    xp_to_next: number;
    streak_days: number;
    streak_week: boolean[];
    subscription_status: string;
    last_active_date: string | null;
};

export default function AdminPage() {
    const [activeTab,  setActiveTab]  = useState<AdminTab>('players');

    // ── 학습자 대시보드 state ─────────────────────────────────────────────
    const [players, setPlayers] = useState<PlayerRow[]>([]);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playersError, setPlayersError] = useState<string>('');
    const [syncing, setSyncing] = useState(false);

    const fetchPlayers = async () => {
        setPlayersLoading(true);
        setPlayersError('');
        try {
            const res = await fetch('/api/admin/players');
            const data = await res.json();
            if (!res.ok) {
                setPlayersError(res.status === 401 || res.status === 403
                    ? '관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.'
                    : (data.error || '학습자 데이터를 불러오지 못했습니다.'));
                setPlayers([]);
                return;
            }
            setPlayers(data.players || []);
        } catch (err) {
            console.error(err);
            setPlayersError('학습자 데이터를 불러오지 못했습니다.');
        } finally {
            setPlayersLoading(false);
        }
    };

    // ── Attempts state ────────────────────────────────────────────────────
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ score: string; feedback: string }>({ score: '', feedback: '' });

    // ── Expression Progress state ─────────────────────────────────────────
    const [exprSummary,    setExprSummary]    = useState<PlayerExprSummary[]>([]);
    const [exprLoading,    setExprLoading]    = useState(false);
    const [lessonFilter,   setLessonFilter]   = useState('');
    const [lessonOptions,  setLessonOptions]  = useState<string[]>([]);

    const fetchExpressionProgress = async (lesson = '') => {
        setExprLoading(true);
        try {
            const url = lesson
                ? `/api/admin/expression-progress?lessonId=${lesson}`
                : '/api/admin/expression-progress';
            const res  = await fetch(url);
            const data = await res.json();
            if (data.summary) setExprSummary(data.summary);
            // Collect unique lesson IDs for filter dropdown
            const ids = Array.from(new Set(
                (data.summary ?? []).flatMap((p: PlayerExprSummary) =>
                    p.records.map((r: ExprRecord) => r.expression_id)
                )
            )) as string[];
            if (!lesson) setLessonOptions(ids);
        } catch (err) {
            console.error(err);
        } finally {
            setExprLoading(false);
        }
    };

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
        // 기본 탭이 학습자 대시보드 → 첫 로드 시 학습자 데이터 조회
        fetchPlayers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/sync-content', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert('동기화 완료: ' + (data.message || '성공'));
            } else {
                alert('동기화 실패: ' + (data.error || res.status));
            }
        } catch (err) {
            console.error(err);
            alert('동기화 요청 중 오류가 발생했습니다.');
        } finally {
            setSyncing(false);
        }
    };

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

    const handleTabChange = (tab: AdminTab) => {
        setActiveTab(tab);
        if (tab === 'expressions' && exprSummary.length === 0) {
            fetchExpressionProgress();
        }
        if (tab === 'players') {
            fetchPlayers();
        }
        if (tab === 'attempts' && attempts.length === 0) {
            fetchAttempts();
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Admin Dashboard</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => window.location.href = '/admin/intake'}
                        className={styles.refreshButton}
                        style={{ background: '#10b981' }}
                    >
                        🚀 Smart Intake Tool
                    </button>
                    <button onClick={handleSync} disabled={syncing} className={styles.refreshButton} style={{ background: '#6366f1', opacity: syncing ? 0.6 : 1 }}>
                        {syncing ? '⏳ 동기화 중…' : '🔄 시트 동기화'}
                    </button>
                    <button onClick={() => (activeTab === 'players' ? fetchPlayers() : fetchAttempts())} className={styles.refreshButton}>새로고침</button>
                </div>
            </header>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '0.75rem', padding: '0 1.5rem', marginBottom: '1rem' }}>
                {(['players', 'attempts', 'expressions'] as AdminTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        style={{
                            padding: '0.4rem 1.2rem',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: activeTab === tab ? '#2962ff' : '#ddd',
                            background:  activeTab === tab ? '#2962ff' : '#fff',
                            color:       activeTab === tab ? '#fff'    : '#555',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        {tab === 'players' ? '👥 학습자 대시보드' : tab === 'attempts' ? '🎙️ Attempts' : '📌 Expression Progress'}
                    </button>
                ))}
            </div>

            {/* ── 학습자 대시보드 (요일 스트릭) Tab ─────────────────────────── */}
            {activeTab === 'players' && (
                <div style={{ padding: '0 1.5rem 2rem' }}>
                    {playersError && (
                        <p style={{ color: '#dc2626', textAlign: 'center', fontWeight: 600, padding: '1rem' }}>{playersError}</p>
                    )}
                    {playersLoading ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>불러오는 중…</p>
                    ) : !playersError && players.length === 0 ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>학습자가 없습니다.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#555' }}>
                                        <th style={{ padding: '0.6rem 0.5rem' }}>학습자</th>
                                        <th style={{ padding: '0.6rem 0.5rem' }}>Lv / XP</th>
                                        <th style={{ padding: '0.6rem 0.5rem' }}>스트릭</th>
                                        <th style={{ padding: '0.6rem 0.5rem' }}>이번 주 (월→일)</th>
                                        <th style={{ padding: '0.6rem 0.5rem' }}>최근 활동</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map(p => {
                                        const week = Array.isArray(p.streak_week) ? p.streak_week : [];
                                        const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
                                        return (
                                            <tr key={p.player_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{p.display_name || '풋볼러'}</div>
                                                    <div style={{ color: '#999', fontSize: '0.75rem' }}>{p.email}</div>
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: 800, color: '#f59e0b' }}>Lv.{p.level ?? 1}</span>
                                                    <span style={{ color: '#888', marginLeft: 6 }}>{(p.xp ?? 0).toLocaleString()} XP</span>
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 800, color: '#ef4444' }}>🔥 {p.streak_days ?? 0}일</td>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        {dayLabels.map((d, i) => (
                                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                <span style={{
                                                                    width: 22, height: 22, borderRadius: '50%',
                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.7rem', fontWeight: 800,
                                                                    background: week[i] ? '#22c55e' : '#e5e7eb',
                                                                    color: week[i] ? '#fff' : 'transparent',
                                                                }}>✓</span>
                                                                <span style={{ fontSize: '0.65rem', color: '#999' }}>{d}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', color: '#666', whiteSpace: 'nowrap' }}>{p.last_active_date || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Expression Progress Tab ──────────────────────────────────── */}
            {activeTab === 'expressions' && (
                <div style={{ padding: '0 1.5rem 2rem' }}>
                    {/* Lesson filter */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                        <select
                            value={lessonFilter}
                            onChange={e => {
                                setLessonFilter(e.target.value);
                                fetchExpressionProgress(e.target.value);
                            }}
                            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                        >
                            <option value="">전체 레슨</option>
                            {lessonOptions.map(id => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => fetchExpressionProgress(lessonFilter)}
                            className={styles.refreshButton}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                        >
                            새로고침
                        </button>
                    </div>

                    {exprLoading ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>Loading...</p>
                    ) : exprSummary.length === 0 ? (
                        <p style={{ color: '#888', textAlign: 'center' }}>학습 기록이 없습니다.</p>
                    ) : (
                        exprSummary.map(player => (
                            <div key={player.player_id} style={{ marginBottom: '2rem', background: '#fafafa', borderRadius: '12px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <strong style={{ fontSize: '1rem' }}>{player.player_id}</strong>
                                    <span style={{
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        background: player.completion_rate === 100 ? '#e8f5e9' : '#e8eeff',
                                        color:      player.completion_rate === 100 ? '#2e7d32' : '#2962ff',
                                    }}>
                                        완료율 {player.completion_rate}%
                                    </span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #eee', color: '#888' }}>
                                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>표현</th>
                                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>방식</th>
                                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Cloze</th>
                                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Speaking</th>
                                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>완료</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {player.records.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                                                    {r.expression}
                                                    <div style={{ fontWeight: 400, color: '#888', fontSize: '0.78rem' }}>{r.meaning_kr}</div>
                                                </td>
                                                <td style={{ padding: '0.4rem 0.5rem', color: '#555' }}>{r.mode}</td>
                                                <td style={{ padding: '0.4rem 0.5rem' }}>
                                                    {r.cloze_answer ? (
                                                        <span>
                                                            <span style={{ color: r.cloze_score >= 80 ? '#2e7d32' : '#e65100', fontWeight: 700 }}>{r.cloze_score}점</span>
                                                            <span style={{ color: '#aaa', marginLeft: '0.3rem', fontSize: '0.75rem' }}>"{r.cloze_answer}"</span>
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ padding: '0.4rem 0.5rem' }}>
                                                    {r.speaking_completed ? (
                                                        <span>
                                                            ✅
                                                            {r.speaking_audio_url && (
                                                                <button
                                                                    onClick={() => new Audio(r.speaking_audio_url).play()}
                                                                    style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                                                >
                                                                    ▶
                                                                </button>
                                                            )}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ padding: '0.4rem 0.5rem' }}>
                                                    {r.completed
                                                        ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>✅</span>
                                                        : <span style={{ color: '#aaa' }}>—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Attempts Tab ─────────────────────────────────────────────── */}
            {activeTab === 'attempts' && (
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
            )}
        </div>
    );
}
