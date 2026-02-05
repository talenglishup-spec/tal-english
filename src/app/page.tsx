'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<'player' | 'teacher'>('player');

  // Inputs
  const [playerId, setPlayerId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [teacherPw, setTeacherPw] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = activeTab === 'teacher'
        ? { role: 'teacher', username: teacherId, password: teacherPw }
        : { role: 'player', username: playerId };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>⚽ Football English Trainer</h1>
        <p className={styles.subtitle}>Welcome back!</p>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'player' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('player')}
          >
            Player
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'teacher' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('teacher')}
          >
            Teacher
          </button>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          {activeTab === 'player' ? (
            <div className={styles.inputGroup}>
              <label>Player ID (or Name)</label>
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="Enter your ID e.g. player01"
                required
              />
            </div>
          ) : (
            <>
              <div className={styles.inputGroup}>
                <label>Teacher ID</label>
                <input
                  type="text"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Password</label>
                <input
                  type="password"
                  value={teacherPw}
                  onChange={(e) => setTeacherPw(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Verifying...' : (activeTab === 'player' ? 'Start Training' : 'Teacher Dashboard')}
          </button>
        </form>
      </div>
    </div>
  );
}
