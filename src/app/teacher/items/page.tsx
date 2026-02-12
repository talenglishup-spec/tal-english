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
            const res = await fetch('/api/train/items'); // No params = all items
            const data = await res.json();
            if (data.items) setItems(data.items);
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
                                <th>Target (EN)</th>
                                <th>Audio</th>
                                <th>Source</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.category}/{item.sub_category}</td>
                                    <td>{item.prompt_kr}</td>
                                    <td>{item.target_en}</td>
                                    <td>
                                        {item.model_audio_url ? (
                                            <a href={item.model_audio_url} target="_blank" rel="noreferrer">
                                                🔊 Play
                                            </a>
                                        ) : (
                                            <span style={{ color: '#999' }}>None</span>
                                        )}
                                    </td>
                                    <td>{item.audio_source || '-'}</td>
                                    <td>
                                        <button
                                            onClick={() => handleGenerate([item.id], !!item.model_audio_url)}
                                            disabled={generating.has(item.id)}
                                            className={styles.actionBtn}
                                        >
                                            {generating.has(item.id) ? '...' : (item.model_audio_url ? 'Regenerate' : 'Generate')}
                                        </button>
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
