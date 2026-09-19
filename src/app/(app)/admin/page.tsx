'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './AdminPage.module.css';
import {
    AXIS_LABELS, MIN_CELL, ageOf, computeMetrics, groupMetrics, clipStats,
    type SegmentAxis, type TrialPlayer, type PlayerClip,
} from '@/lib/trialSegments';

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

type AdminTab = 'trial' | 'players' | 'attempts' | 'expressions';

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

type TrialData = {
    generatedAt: string;
    todayKst: string;
    players: TrialPlayer[];
    playerClip: PlayerClip[];
    clipMeta: {
        clip_id: string; phrase: string; level: string; saved: number;
        views: number; avgDwellSec: number; speakTriggered: number; speakCompleted: number;
    }[];
    hourly: { hour: number; sessions: number; attempts: number }[];
    daily: { date: string; activeUsers: number; sessions: number; attempts: number; passed: number }[];
    notifSummary: { sent: number; delivered: number; opened: number };
    speakFunnel: { triggered: number; completed: number; abandonRate: number; hasData: boolean };
};

export default function AdminPage() {
    const [activeTab,  setActiveTab]  = useState<AdminTab>('trial');

    // ── 체험단 분석 ───────────────────────────────────────────────────────
    const [trial, setTrial] = useState<TrialData | null>(null);
    const [trialLoading, setTrialLoading] = useState(false);
    const [trialError, setTrialError] = useState('');
    const [axis, setAxis] = useState<SegmentAxis>('study_years');
    const [grouped, setGrouped] = useState(true);   // 기본은 2그룹 병합(표본 확보)

    const fetchTrial = async () => {
        setTrialLoading(true);
        setTrialError('');
        try {
            // /admin?since=2026-09-25 처럼 열면 그날 이전 가입자(사전 테스트 계정)를 분석에서 뺀다
            const qs = new URLSearchParams(window.location.search);
            const pass = new URLSearchParams();
            if (qs.get('since')) pass.set('since', qs.get('since')!);
            if (qs.get('staff')) pass.set('staff', qs.get('staff')!);
            const res = await fetch('/api/admin/trial-analytics' + (pass.toString() ? `?${pass}` : ''));
            const data = await res.json();
            if (!res.ok) {
                setTrialError(res.status === 401 || res.status === 403
                    ? '관리자 권한이 필요합니다.'
                    : (data.error || '데이터를 불러오지 못했습니다.'));
                setTrial(null);
                return;
            }
            setTrial(data);
        } catch (e: any) {
            setTrialError(e.message || '데이터를 불러오지 못했습니다.');
        } finally {
            setTrialLoading(false);
        }
    };

    // 전체 지표 / 세그먼트 분해 (데이터가 바뀔 때만 재계산)
    const overall = useMemo(() => trial ? computeMetrics(trial.players) : null, [trial]);
    const segments = useMemo(
        () => trial ? groupMetrics(trial.players, axis, grouped) : [],
        [trial, axis, grouped]
    );
    const clips = useMemo(() => {
        if (!trial) return [];
        const ids = new Set(trial.players.map(p => p.player_id));
        return clipStats(trial.playerClip, ids, trial.clipMeta);
    }, [trial]);

    // ── 학습자 대시보드 state ─────────────────────────────────────────────
    const [players, setPlayers] = useState<PlayerRow[]>([]);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playersError, setPlayersError] = useState<string>('');
    const [syncing, setSyncing] = useState(false);

    // ── AI 모범답안 TTS (ElevenLabs US/UK) ───────────────────────────────
    const [ttsGenerating, setTtsGenerating] = useState(false);
    const [ttsResult, setTtsResult] = useState<string>('');

    const handleGenerateModelAudio = async (force = false) => {
        if (!confirm(`Speak 클립의 AI 모범답안(미국식/영국식)을 ${force ? '전체 재생성' : '생성'}할까요?\nElevenLabs 요금이 발생합니다.`)) return;
        setTtsGenerating(true);
        setTtsResult('');
        try {
            const res = await fetch('/api/admin/generate-model-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setTtsResult(`❌ ${data.error || '생성 실패'}`);
                return;
            }
            const gen = data.results.filter((r: any) => r.status === 'generated').length;
            const skip = data.results.filter((r: any) => r.status === 'skipped').length;
            const err = data.results.filter((r: any) => r.status === 'error');
            setTtsResult(
                `✅ 생성 ${gen} · 스킵 ${skip} · 실패 ${err.length}` +
                (err.length ? ` — ${err.map((e: any) => `${e.clip_id}: ${e.error}`).join(' / ')}` : '')
            );
        } catch (e: any) {
            setTtsResult(`❌ ${e.message}`);
        } finally {
            setTtsGenerating(false);
        }
    };

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
        // 기본 탭이 체험단 분석 → 첫 로드 시 분석 데이터 조회
        fetchTrial();
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

    // ── 콘텐츠 새로고침 (Clips 시트 캐시 무효화) ─────────────────────────
    // 구글시트 Clips에 클립을 추가하거나 순서(level/level_order)를 바꾼 뒤 누르면
    // 배포 없이 즉시 앱에 반영된다. (누르지 않으면 최대 1시간 뒤 자동 반영)
    const [refreshingContent, setRefreshingContent] = useState(false);
    const [contentResult, setContentResult] = useState<string>('');

    const handleRefreshContent = async () => {
        setRefreshingContent(true);
        setContentResult('');
        try {
            const res = await fetch('/api/revalidate', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.revalidated) {
                setContentResult(`❌ ${data.error || '새로고침 실패'}`);
                return;
            }
            const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            setContentResult(
                data.clipCount != null
                    ? `✅ ${time} 반영 완료 — 전체 ${data.clipCount}개 (Speak ${data.speakCount}개)`
                    : `✅ ${time} 반영 완료`
            );
        } catch (e: any) {
            setContentResult(`❌ ${e.message}`);
        } finally {
            setRefreshingContent(false);
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
        if (tab === 'trial' && !trial) {
            fetchTrial();
        }
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
                <button
                    onClick={() => (
                        activeTab === 'trial' ? fetchTrial()
                        : activeTab === 'players' ? fetchPlayers()
                        : activeTab === 'attempts' ? fetchAttempts()
                        : fetchExpressionProgress(lessonFilter)
                    )}
                    className={styles.refreshButton}
                    title="지금 보고 있는 표의 데이터를 다시 불러옵니다"
                >
                    ↻ 화면 새로고침
                </button>
            </header>

            {/* ── 콘텐츠 관리 도구 ────────────────────────────────────────────
                버튼 이름만으로는 역할이 헷갈렸던 것들을 한 줄 설명과 함께 묶는다.
                (콘텐츠 새로고침 = Clips 캐시 / 레슨 동기화 = ContentIntake 가공) */}
            <section className={styles.toolBar}>
                <div className={styles.toolBarTitle}>콘텐츠 관리</div>
                <div className={styles.toolGrid}>
                    {/* 1. 쇼츠 클립 반영 */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolHead}>
                            <span className={styles.toolName}>🎬 쇼츠 콘텐츠 새로고침</span>
                            <button
                                onClick={handleRefreshContent}
                                disabled={refreshingContent}
                                className={styles.toolBtn}
                                style={{ background: '#0A228F', opacity: refreshingContent ? 0.6 : 1 }}
                            >
                                {refreshingContent ? '⏳ 반영 중…' : '지금 반영'}
                            </button>
                        </div>
                        <p className={styles.toolDesc}>
                            구글시트 <b>Clips</b>에 클립을 추가하거나 순서(level·level_order)를 바꾼 뒤 누르면
                            <b> 배포 없이 즉시</b> 앱에 반영됩니다. (안 누르면 최대 1시간 뒤 자동 반영)
                        </p>
                        {contentResult && <div className={styles.toolResult}>{contentResult}</div>}
                    </div>

                    {/* 2. 레슨 콘텐츠 파이프라인 */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolHead}>
                            <span className={styles.toolName}>📥 레슨 콘텐츠 동기화</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => window.location.href = '/admin/intake'}
                                    className={styles.toolBtn}
                                    style={{ background: '#10b981' }}
                                >
                                    입력 도구
                                </button>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className={styles.toolBtn}
                                    style={{ background: '#6366f1', opacity: syncing ? 0.6 : 1 }}
                                >
                                    {syncing ? '⏳ 동기화 중…' : '동기화 실행'}
                                </button>
                            </div>
                        </div>
                        <p className={styles.toolDesc}>
                            <b>ContentIntake</b> 시트에 입력한 레슨·표현을 Items/Lessons 시트로 가공합니다.
                            쇼츠 클립과는 <b>별개</b>이며, 수십 초 걸릴 수 있습니다.
                        </p>
                    </div>

                    {/* 3. AI 모범답안 TTS */}
                    <div className={styles.toolCard}>
                        <div className={styles.toolHead}>
                            <span className={styles.toolName}>🔊 AI 모범답안 (미국식/영국식)</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleGenerateModelAudio(false)} disabled={ttsGenerating} className={styles.toolBtn} style={{ background: '#0ea5e9', opacity: ttsGenerating ? 0.6 : 1 }}>
                                    {ttsGenerating ? '⏳ 생성 중…' : '누락분 생성'}
                                </button>
                                <button onClick={() => handleGenerateModelAudio(true)} disabled={ttsGenerating} className={styles.toolBtn} style={{ background: '#f59e0b', opacity: ttsGenerating ? 0.6 : 1 }}>
                                    전체 재생성
                                </button>
                            </div>
                        </div>
                        <p className={styles.toolDesc}>
                            Speak 클립의 원어민 발음을 ElevenLabs로 생성합니다. 발음 버튼이 안 보이는 클립이 있으면 <b>누락분 생성</b>을 누르세요.
                            <b> ElevenLabs 요금이 발생</b>합니다.
                        </p>
                        {ttsResult && <div className={styles.toolResult}>{ttsResult}</div>}
                    </div>
                </div>
            </section>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '0.75rem', padding: '0 1.5rem', marginBottom: '1rem' }}>
                {(['trial', 'players', 'attempts', 'expressions'] as AdminTab[]).map(tab => (
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
                        {tab === 'trial' ? '📊 체험단 분석'
                            : tab === 'players' ? '👥 학습자 대시보드'
                            : tab === 'attempts' ? '🎙️ Attempts (레거시)'
                            : '📌 Expression Progress (레거시)'}
                    </button>
                ))}
            </div>

            {/* ── 체험단 분석 Tab ────────────────────────────────────────── */}
            {activeTab === 'trial' && (
                <div style={{ padding: '0 1.5rem 2rem' }}>
                    {trialError && <p style={{ color: '#dc2626', textAlign: 'center', fontWeight: 600, padding: '1rem' }}>{trialError}</p>}
                    {trialLoading && <p style={{ color: '#888', textAlign: 'center' }}>불러오는 중…</p>}

                    {trial && overall && (
                        <>
                            {/* A. 요약 KPI */}
                            <div className={styles.kpiRow}>
                                {[
                                    { label: '체험 참여자', value: `${overall.n}명`, sub: `프로필 응답 ${trial.players.filter(p => p.study_years).length}명` },
                                    { label: '평균 학습시간', value: `${overall.avgMinutes}분`, sub: '1인 누적' },
                                    { label: '평균 세션', value: `${overall.avgSessions}회`, sub: `활동일 ${overall.avgActiveDays}일` },
                                    { label: 'Speak 합격률', value: `${overall.passRate}%`, sub: `평균 ${overall.avgAttempts}회 시도` },
                                    {
                                        label: 'Speak 포기율',
                                        value: trial.speakFunnel.hasData ? `${trial.speakFunnel.abandonRate}%` : '—',
                                        sub: trial.speakFunnel.hasData
                                            ? `버튼 ${trial.speakFunnel.triggered} → 녹음 ${trial.speakFunnel.completed}`
                                            : '수집 대기(013 필요)',
                                    },
                                    { label: '유지율 D1/D3/D7', value: `${overall.d1}/${overall.d3}/${overall.d7}%`, sub: '가입일 기준' },
                                ].map(k => (
                                    <div key={k.label} className={styles.kpiCard}>
                                        <div className={styles.kpiLabel}>{k.label}</div>
                                        <div className={styles.kpiValue}>{k.value}</div>
                                        <div className={styles.kpiSub}>{k.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* B. 세그먼트 비교 */}
                            <div className={styles.sectionHead}>
                                <h2 className={styles.sectionTitle}>집단별 비교</h2>
                                <div className={styles.segControls}>
                                    <select className={styles.segSelect} value={axis} onChange={e => setAxis(e.target.value as SegmentAxis)}>
                                        {(Object.keys(AXIS_LABELS) as SegmentAxis[]).map(a => (
                                            <option key={a} value={a}>{AXIS_LABELS[a]}</option>
                                        ))}
                                    </select>
                                    <label className={styles.segToggle}>
                                        <input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} />
                                        묶어보기(2그룹)
                                    </label>
                                </div>
                            </div>
                            <p className={styles.sectionHint}>
                                체험단 규모에선 축을 잘게 쪼개면 칸마다 인원이 1~2명이 되어 해석이 위험합니다.
                                기본은 <b>묶어보기</b>이며, <b>{MIN_CELL}명 미만</b> 그룹은 회색으로 표시됩니다.
                            </p>

                            <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                                <table className={styles.segTable}>
                                    <thead>
                                        <tr>
                                            <th>{AXIS_LABELS[axis]}</th>
                                            <th>인원</th>
                                            <th>D1</th><th>D3</th><th>D7</th>
                                            <th>평균 학습(분)</th>
                                            <th>평균 세션</th>
                                            <th>합격률</th>
                                            <th>평균 완료표현</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {segments.map(s => {
                                            const weak = s.metrics.n < MIN_CELL;
                                            return (
                                                <tr key={s.name} style={weak ? { color: '#9ca3af', background: '#fafafa' } : undefined}>
                                                    <td style={{ fontWeight: 700 }}>
                                                        {s.name}
                                                        {weak && <span className={styles.weakBadge}>표본 부족</span>}
                                                    </td>
                                                    <td>{s.metrics.n}</td>
                                                    <td>{s.metrics.d1}%</td>
                                                    <td>{s.metrics.d3}%</td>
                                                    <td>{s.metrics.d7}%</td>
                                                    <td>{s.metrics.avgMinutes}</td>
                                                    <td>{s.metrics.avgSessions}</td>
                                                    <td>{s.metrics.passRate}%</td>
                                                    <td>{s.metrics.avgPassedClips}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* C. 시간대 히트맵 */}
                            <h2 className={styles.sectionTitle}>시간대별 활동 (KST)</h2>
                            <p className={styles.sectionHint}>알림 시간 최적화 근거. 막대가 높은 시간대에 학습이 몰립니다.</p>
                            <div className={styles.hourRow}>
                                {trial.hourly.map(h => {
                                    const max = Math.max(1, ...trial.hourly.map(x => x.sessions));
                                    const pct = Math.round((h.sessions / max) * 100);
                                    return (
                                        <div key={h.hour} className={styles.hourCol} title={`${h.hour}시 · 세션 ${h.sessions} · 시도 ${h.attempts}`}>
                                            <div className={styles.hourBarWrap}>
                                                <div className={styles.hourBar} style={{ height: `${pct}%` }} />
                                            </div>
                                            <span className={styles.hourLabel}>{h.hour}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* D. 콘텐츠 난이도 */}
                            <h2 className={styles.sectionTitle} style={{ marginTop: '2rem' }}>표현별 성과</h2>
                            <p className={styles.sectionHint}>합격률이 낮고 시도 횟수가 많은 표현 = 난이도 조정 후보.</p>
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.segTable}>
                                    <thead>
                                        <tr>
                                            <th>표현</th><th>레벨</th><th>시청</th><th>평균 체류</th>
                                            <th>Speak 포기율</th><th>학습자</th><th>시도</th>
                                            <th>합격률</th><th>1인 평균시도</th><th>저장</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clips.length === 0 ? (
                                            <tr><td colSpan={10} style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>아직 학습 기록이 없습니다.</td></tr>
                                        ) : (
                                            [...clips].sort((a, b) => a.passRate - b.passRate).map(c => (
                                                <tr key={c.clip_id}>
                                                    <td style={{ fontWeight: 600 }}>{c.phrase}</td>
                                                    <td>{c.level || '-'}</td>
                                                    <td>{c.views || '-'}</td>
                                                    <td>{c.avgDwellSec ? `${c.avgDwellSec}초` : '-'}</td>
                                                    <td style={c.abandonRate != null && c.abandonRate >= 50 ? { color: '#dc2626', fontWeight: 700 } : undefined}>
                                                        {c.abandonRate != null ? `${c.abandonRate}%` : '-'}
                                                    </td>
                                                    <td>{c.learners}</td>
                                                    <td>{c.attempts}</td>
                                                    <td style={{ fontWeight: 700, color: c.passRate < 50 ? '#dc2626' : c.passRate < 75 ? '#f59e0b' : '#16a34a' }}>
                                                        {c.passRate}%
                                                    </td>
                                                    <td>{c.avgAttempts}</td>
                                                    <td>{c.saved}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* E. 학습자별 상세 */}
                            <h2 className={styles.sectionTitle} style={{ marginTop: '2rem' }}>학습자별 상세</h2>
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.segTable}>
                                    <thead>
                                        <tr>
                                            <th>학습자</th><th>나이</th><th>학습기간</th><th>자신감</th>
                                            <th>세션</th><th>학습(분)</th><th>시도</th><th>합격률</th>
                                            <th>완료표현</th><th>알림</th><th>마지막 활동</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...trial.players].sort((a, b) => b.sessions - a.sessions).map(p => {
                                            const age = ageOf(p.birth_date);
                                            const rate = p.attempts > 0 ? Math.round((p.passed / p.attempts) * 100) : 0;
                                            return (
                                                <tr key={p.player_id}>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{p.display_name || '풋볼러'}</div>
                                                        <div style={{ color: '#999', fontSize: '0.72rem' }}>{p.email}</div>
                                                    </td>
                                                    <td>{age ?? '-'}</td>
                                                    <td>{p.study_years || '-'}</td>
                                                    <td>{p.self_level || '-'}</td>
                                                    <td>{p.sessions}</td>
                                                    <td>{(p.totalDwellMs / 60000).toFixed(1)}</td>
                                                    <td>{p.attempts}</td>
                                                    <td>{rate}%</td>
                                                    <td>{p.passedClips}</td>
                                                    <td>{p.notify_opt_in ? `ON ${p.notify_hour ?? ''}시` : 'OFF'}</td>
                                                    <td style={{ whiteSpace: 'nowrap', color: '#666' }}>{p.last_active_date || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <p className={styles.sectionHint} style={{ marginTop: '1rem' }}>
                                알림 발송 {trial.notifSummary.sent} · 전달 {trial.notifSummary.delivered} · 열람 {trial.notifSummary.opened}
                                &nbsp;|&nbsp; 생성 {new Date(trial.generatedAt).toLocaleString('ko-KR')}
                            </p>
                        </>
                    )}
                </div>
            )}

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
