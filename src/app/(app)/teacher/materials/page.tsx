'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from '../TeacherPage.module.css'; // Reuse existing styles

export default function MaterialsManagerPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [materials, setMaterials] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [type, setType] = useState('video');
    const [playerId, setPlayerId] = useState('all');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'teacher')) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    const fetchMaterials = () => {
        fetch('/api/teacher/materials')
            .then(res => res.json())
            .then(data => {
                setMaterials(data.materials || []);
                setLoadingData(false);
            });
    };

    useEffect(() => {
        if (user?.role === 'teacher') fetchMaterials();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/teacher/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, url, type, player_id: playerId })
            });
            const data = await res.json();
            if (data.success) {
                alert('Material Added!');
                setTitle('');
                setUrl('');
                fetchMaterials(); // Refresh list
            } else {
                alert('Failed: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error submitting');
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button onClick={() => router.push('/teacher')} style={{ marginBottom: '1rem', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>← Dashboard</button>
                <h1>📚 Manage Class Materials</h1>
                <p>Upload videos or documents for players.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* Form */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: 'fit-content' }}>
                    <h3 style={{ marginTop: 0, color: '#333' }}>Add New Material</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>Title</label>
                            <input
                                value={title} onChange={e => setTitle(e.target.value)} required
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                placeholder="e.g. Week 1 Tactics Review"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>URL</label>
                            <input
                                value={url} onChange={e => setUrl(e.target.value)} required
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                placeholder="https://youtube.com/..."
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>Type</label>
                                <select
                                    value={type} onChange={e => setType(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                >
                                    <option value="video">Video (YouTube)</option>
                                    <option value="document">Document</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>Assign To</label>
                                <select
                                    value={playerId} onChange={e => setPlayerId(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                                >
                                    <option value="all">All Players</option>
                                    <option value="id001">id001</option>
                                    <option value="id002">id002</option>
                                    {/* Ideally dynamic but static for now */}
                                </select>
                            </div>
                        </div>
                        <button
                            type="submit" disabled={submitting}
                            style={{
                                background: '#0070f3', color: 'white', border: 'none', padding: '12px',
                                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px'
                            }}
                        >
                            {submitting ? 'Adding...' : 'Add Material'}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, color: '#333' }}>Recent Uploads</h3>
                    {loadingData ? <p>Loading...</p> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '10px', fontSize: '0.85rem', color: '#888' }}>Date</th>
                                    <th style={{ padding: '10px', fontSize: '0.85rem', color: '#888' }}>Title</th>
                                    <th style={{ padding: '10px', fontSize: '0.85rem', color: '#888' }}>Type</th>
                                    <th style={{ padding: '10px', fontSize: '0.85rem', color: '#888' }}>Target</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materials.map((m: any) => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '12px', fontSize: '0.9rem' }}>{m.date_added}</td>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>
                                            <a href={m.url} target="_blank" style={{ color: '#0070f3', textDecoration: 'none' }}>
                                                {m.title}
                                            </a>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                background: m.type === 'video' ? '#ffebee' : '#e3f2fd',
                                                color: m.type === 'video' ? '#c62828' : '#1565c0',
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700
                                            }}>
                                                {m.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '0.9rem', color: '#666' }}>{m.player_id}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
