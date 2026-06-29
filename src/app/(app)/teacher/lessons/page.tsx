'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './LessonManager.module.css';

interface Player {
    id: string;
    name: string;
}

interface Lesson {
    lesson_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
    active: boolean;
}

interface Item {
    id: string;
    category: string;
    situation: string;
}

export default function LessonManager() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState('');

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'teacher')) {
            router.push('/');
        }
    }, [user, isLoading, router]);


    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loadingLessons, setLoadingLessons] = useState(false);

    // Create Lesson Inputs
    const [newLessonNo, setNewLessonNo] = useState('');
    const [newLessonDate, setNewLessonDate] = useState('');
    const [newLessonNote, setNewLessonNote] = useState('');

    // Selected Lesson Details
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [lessonItems, setLessonItems] = useState<Item[]>([]);
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [itemInput, setItemInput] = useState('');

    // Fetch players on mount
    useEffect(() => {
        // Mock players for MVP or fetch from somewhere?
        // We don't have a getPlayers API yet, lets just hardcode or fetch from a new endpoint?
        // Plan said: "Select Player: Dropdown of players."
        // We can fetch unique player_ids from Attempts or Auth?
        // Let's create a simple API for players later. For now, manual input or hardcoded.
        // Actually, we can fetch from Sheets if we had a Users sheet.
        // Let's assume 'test-player' and 'player01' for now.
        setPlayers([
            { id: 'test-player', name: 'Test Player' },
            { id: 'player01', name: 'Player 01' },
            { id: 'sangha', name: 'Sangha Lee' }
        ]);

        // Fetch all items for assignment dropdown
        async function fetchAllItems() {
            const res = await fetch('/api/train/items');
            const data = await res.json();
            if (data.items) setAllItems(data.items);
        }
        fetchAllItems();
    }, []);

    // Fetch lessons when player selected
    useEffect(() => {
        if (!selectedPlayer) return;
        fetchLessons();
    }, [selectedPlayer]);

    const fetchLessons = async () => {
        setLoadingLessons(true);
        try {
            const res = await fetch(`/api/train/lessons?playerId=${selectedPlayer}`);
            const data = await res.json();
            if (data.lessons) setLessons(data.lessons);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLessons(false);
        }
    };

    // Fetch lesson items
    useEffect(() => {
        if (!selectedLesson) return;
        fetchLessonItems();
    }, [selectedLesson]);

    const fetchLessonItems = async () => {
        if (!selectedLesson) return;
        const res = await fetch(`/api/train/items?lessonId=${selectedLesson.lesson_id}`);
        const data = await res.json();
        if (data.items) setLessonItems(data.items);
    };

    const handleCreateLesson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return alert('Select a player');

        const lessonId = `${selectedPlayer}_L${newLessonNo}`;

        const res = await fetch('/api/teacher/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lesson_id: lessonId,
                player_id: selectedPlayer,
                lesson_no: Number(newLessonNo),
                lesson_date: newLessonDate,
                note: newLessonNote,
                active: true
            })
        });

        if (res.ok) {
            setNewLessonNo('');
            setNewLessonDate('');
            setNewLessonNote('');
            fetchLessons();
            alert('Lesson created!');
        } else {
            alert('Failed to create lesson');
        }
    };

    const handleAddItem = async () => {
        if (!selectedLesson || !itemInput) return;

        const res = await fetch('/api/teacher/lessons/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lessonId: selectedLesson.lesson_id,
                itemId: itemInput
            })
        });

        if (res.ok) {
            setItemInput('');
            fetchLessonItems();
        } else {
            alert('Failed to add item');
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!selectedLesson) return;
        if (!confirm('Remove item?')) return;

        const res = await fetch(`/api/teacher/lessons/items?lessonId=${selectedLesson.lesson_id}&itemId=${itemId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchLessonItems();
        } else {
            alert('Failed to remove');
        }
    };

    return (
        <div className={styles.container}>
            <h1>Teacher Lesson Manager</h1>

            <div className={styles.controls}>
                <label>Select Player: </label>
                <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
                    <option value="">-- Select --</option>
                    {players.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                </select>
            </div>

            {selectedPlayer && (
                <div className={styles.panels}>
                    {/* Left Panel: Lessons List & Create */}
                    <div className={styles.leftPanel}>
                        <div className={styles.createBox}>
                            <h3>Create Lesson</h3>
                            <form onSubmit={handleCreateLesson}>
                                <input placeholder="No." type="number" value={newLessonNo} onChange={e => setNewLessonNo(e.target.value)} required />
                                <input type="date" value={newLessonDate} onChange={e => setNewLessonDate(e.target.value)} required />
                                <input placeholder="Note (e.g. Grammar focus)" value={newLessonNote} onChange={e => setNewLessonNote(e.target.value)} required />
                                <button type="submit">Create</button>
                            </form>
                        </div>

                        <div className={styles.lessonsList}>
                            <h3>Lessons</h3>
                            {loadingLessons ? <p>Loading...</p> : lessons.map(l => (
                                <div
                                    key={l.lesson_id}
                                    className={`${styles.lessonRow} ${selectedLesson?.lesson_id === l.lesson_id ? styles.activeLesson : ''}`}
                                    onClick={() => setSelectedLesson(l)}
                                >
                                    <strong>#{l.lesson_no}</strong> {l.note} <span style={{ fontSize: '0.8em', color: '#666' }}>({l.lesson_date})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Selected Lesson Items */}
                    {selectedLesson && (
                        <div className={styles.rightPanel}>
                            <h3>Editing: Lesson {selectedLesson.lesson_no}</h3>

                            <div className={styles.addItemBox}>
                                <select value={itemInput} onChange={e => setItemInput(e.target.value)}>
                                    <option value="">Select Item to Add...</option>
                                    {allItems.map(i => (
                                        <option key={i.id} value={i.id}>[{i.category}] {i.situation} ({i.id})</option>
                                    ))}
                                </select>
                                <button onClick={handleAddItem} disabled={!itemInput}>Add</button>
                            </div>

                            <div className={styles.itemsList}>
                                {lessonItems.map(item => (
                                    <div key={item.id} className={styles.itemRow}>
                                        <span>[{item.category}] {item.situation}</span>
                                        <button onClick={() => handleRemoveItem(item.id)} className={styles.deleteBtn}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
