'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ItemsPage.module.css';

interface Item {
    id: string;
    prompt_kr: string;
    target_en: string;
    model_audio_url?: string;
    audio_source?: string;
    category: string;
    sub_category: string;
    active: boolean;

    // computed stats
    cAvgResponseSpeed?: number;
    cAvgAiScore?: number;
    cTranslationRate?: number;
    cRevealRate?: number;
    cAvgQPlay?: number;

    pAvgModelPlay?: number;
    pAvgDuration?: number;

    healthStatus?: 'Too Hard' | 'Too Easy' | 'Unclear' | 'Normal' | 'No Data';
}

interface Attempt {
    item_id: string;
    session_mode?: string;
    time_to_first_response_ms?: number;
    translation_toggle_count?: number;
    answer_revealed?: boolean;
    duration_sec?: number;
    question_play_count?: number;
    model_play_count?: number;
    ai_score?: number;
}

export default function ItemsManagerPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'missing'>('all');

    useEffect(() => {
        if (user?.role === 'teacher' || user?.role === 'admin') {
            fetchItems();
        }
    }, [user]);

    async function fetchItems() {
        setLoading(true);
        try {
            const [itemsRes, attemptsRes] = await Promise.all([
                fetch('/api/train/items'),
                fetch('/api/teacher/attempts')
            ]);

            const itemsData = await itemsRes.json();
            const attemptsData = await attemptsRes.json();

            if (itemsData.items && attemptsData.attempts) {
                const rawItems: Item[] = itemsData.items;
                const attempts: Attempt[] = attemptsData.attempts;

                // Aggregate stats per item
                const enhancedItems = rawItems.map(item => {
                    const myAttempts = attempts.filter(a => a.item_id === item.id);

                    let cCount = 0; let pCount = 0;
                    let cResp = 0; let cAi = 0; let cTrans = 0; let cRev = 0; let cQPlay = 0;
                    let pModel = 0; let pDur = 0;

                    myAttempts.forEach(a => {
                        if (a.session_mode === 'challenge') {
                            cCount++;
                            cResp += (a.time_to_first_response_ms || 0);
                            cAi += (a.ai_score || 0);
                            if (a.translation_toggle_count && a.translation_toggle_count > 0) cTrans++;
                            if (a.answer_revealed) cRev++;
                            cQPlay += (a.question_play_count || 0);
                        } else {
                            pCount++;
                            pModel += (a.model_play_count || 0);
                            pDur += (a.duration_sec || 0);
                        }
                    });

                    const stats = {
                        cAvgResponseSpeed: cCount > 0 ? Math.round(cResp / cCount) : 0,
                        cAvgAiScore: cCount > 0 ? Math.round(cAi / cCount) : 0,
                        cTranslationRate: cCount > 0 ? cTrans / cCount : 0,
                        cRevealRate: cCount > 0 ? cRev / cCount : 0,
                        cAvgQPlay: cCount > 0 ? cQPlay / cCount : 0,
                        pAvgModelPlay: pCount > 0 ? Number((pModel / pCount).toFixed(1)) : 0,
                        pAvgDuration: pCount > 0 ? Math.round(pDur / pCount) : 0,
                        healthStatus: 'No Data' as 'Too Hard' | 'Too Easy' | 'Unclear' | 'Normal' | 'No Data'
                    };

                    if (cCount > 0) {
                        if (stats.cAvgResponseSpeed > 3000 && stats.cRevealRate > 0.3 && stats.cTranslationRate > 0.3) {
                            stats.healthStatus = 'Too Hard';
                        } else if (stats.cAvgResponseSpeed < 1000 && stats.cRevealRate < 0.1 && stats.cAvgAiScore > 90) {
                            stats.healthStatus = 'Too Easy';
                        } else if (stats.cAvgQPlay > 2 && stats.cAvgAiScore < 60) {
                            stats.healthStatus = 'Unclear';
                        } else {
                            stats.healthStatus = 'Normal';
                        }
                    }

                    return { ...item, ...stats };
                });

                setItems(enhancedItems.sort((a, b) => (a.category + a.id).localeCompare(b.category + b.id)));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleGenerate = async (itemIds: string[], force = false) => {
        if (itemIds.length === 0) return;

        // Optimistic UI updates? No, wait for result.
        const newGenerating = new Set(generating);
        itemIds.forEach(id => newGenerating.add(id));
        setGenerating(newGenerating);

        try {
            const res = await fetch('/api/admin/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds, force })
            });
            const data = await res.json();

            if (data.success) {
                // Update local state with new URLs
                setItems(prev => prev.map(item => {
                    const result = data.results.find((r: any) => r.itemId === item.id);
                    if (result && result.status === 'generated') {
                        return { ...item, model_audio_url: result.url, audio_source: 'tts' };
                    }
                    return item;
                }));
                alert(`Generated ${data.results.filter((r: any) => r.status === 'generated').length} items.`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Network error');
        } finally {
            const cleanup = new Set(generating);
            itemIds.forEach(id => cleanup.delete(id));
            setGenerating(cleanup);
        }
    };

    const filteredItems = items.filter(item => {
        if (filter === 'missing') return !item.model_audio_url;
        return true;
    });

    // Flexible role check
    const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin' || user.id === 'admin' || user.isAdmin);

    if (!isTeacherOrAdmin) return <p>Access Denied</p>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Items & Audio Manager</h1>
                <div className={styles.controls}>

                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className={styles.select}
                    >
                        <option value="all">All Items</option>
                        <option value="missing">Missing Audio Only</option>
                    </select>
                    <button
                        onClick={() => fetchItems()}
                        className={styles.refreshBtn}
                        disabled={loading}
                    >
                        Refresh
                    </button>
                </div>
            </header>

            {loading ? <p>Loading...</p> : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Category</th>
                                <th>Prompt (KR)</th>
                                <th style={{ width: '20%' }}>Target (EN)</th>
                                <th>Health</th>
                                <th>Challenge Metrics</th>
                                <th>Practice Metrics</th>
                                <th>Audio/TTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => (
                                <tr key={item.id}>
                                    <td style={{ fontSize: '0.8rem' }}>{item.id}</td>
                                    <td style={{ fontSize: '0.85rem' }}><strong>{item.category}</strong><br />{item.sub_category}</td>
                                    <td style={{ fontSize: '0.85rem' }}>{item.prompt_kr}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#0070f3' }}>{item.target_en}</td>
                                    <td>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                                            background: item.healthStatus === 'Too Hard' ? '#fee2e2' : item.healthStatus === 'Too Easy' ? '#e0e7ff' : item.healthStatus === 'Unclear' ? '#fef08a' : item.healthStatus === 'Normal' ? '#dcfce7' : '#f1f5f9',
                                            color: item.healthStatus === 'Too Hard' ? '#991b1b' : item.healthStatus === 'Too Easy' ? '#3730a3' : item.healthStatus === 'Unclear' ? '#854d0e' : item.healthStatus === 'Normal' ? '#166534' : '#475569'
                                        }}>
                                            {item.healthStatus}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {item.healthStatus !== 'No Data' ? (
                                            <>
                                                Resp: {item.cAvgResponseSpeed}ms<br />
                                                Trans: {Math.round((item.cTranslationRate || 0) * 100)}% | Rev: {Math.round((item.cRevealRate || 0) * 100)}%<br />
                                                AI Score: {item.cAvgAiScore}
                                            </>
                                        ) : '-'}
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {item.pAvgModelPlay !== undefined ? (
                                            <>
                                                Model Plays: {item.pAvgModelPlay}<br />
                                                Rec. Dur: {item.pAvgDuration}s
                                            </>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {item.model_audio_url ? (
                                                <a href={item.model_audio_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>🔊 Play</a>
                                            ) : (
                                                <span style={{ color: '#999', fontSize: '0.85rem' }}>None</span>
                                            )}
                                            <button
                                                onClick={() => handleGenerate([item.id], !!item.model_audio_url)}
                                                disabled={generating.has(item.id)}
                                                className={styles.actionBtn}
                                                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                            >
                                                {generating.has(item.id) ? '...' : (item.model_audio_url ? 'Regen' : 'Gen TTS')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
