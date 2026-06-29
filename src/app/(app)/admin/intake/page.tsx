'use client';

import React, { useState, useEffect } from 'react';
import styles from './IntakePage.module.css';
import { useRouter } from 'next/navigation';

interface IntakeRow {
  player_id: string;
  lesson_no: number;
  lesson_title_ko: string;
  situation_order: number;
  situation_title_ko: string;
  item_order: number;
  category: string;
  practice_type: string;
  prompt_kr: string;
  target_en: string;
  cloze_target: string;
  expected_phrases: string;
  max_latency_ms: number;
  notes: string;
  active: boolean;
  // 자동 매칭 질문
  suggested_question_id?: string;
  suggested_question_text?: string;
  match_confidence?: number;
  review_needed?: boolean;
}


export default function SmartIntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'pending'; message: string } | null>(null);

  // Form State
  const [playerId, setPlayerId] = useState('P001');
  const [lessonNo, setLessonNo] = useState(1);
  const [lessonTitle, setLessonTitle] = useState('');
  const [situationTitle, setSituationTitle] = useState('');
  const [rawText, setRawText] = useState('');
  
  // Preview State
  const [previewRows, setPreviewRows] = useState<IntakeRow[]>([]);

  // Auto-generate preview as text changes
  useEffect(() => {
    generatePreview();
  }, [rawText, playerId, lessonNo, lessonTitle, situationTitle]);

  const generatePreview = () => {
    if (!rawText.trim()) {
      setPreviewRows([]);
      return;
    }

    const lines = rawText.split('\n').filter(l => l.trim() && l.includes('|'));
    const rows: IntakeRow[] = lines.map((line, idx) => {
      const parts = line.split('|').map(s => s.trim());
      const kr = parts[0] || '';
      const en = parts[1] || '';
      const providedCloze = parts[2] || '';
      
      // Smart Defaults (AI Simulation)
      let category = 'interview';
      let maxLatency = 2000;
      if (kr.includes('경기') || kr.includes('필드') || kr.includes('상황')) {
        category = 'onpitch';
        maxLatency = 1500;
      } else if (kr.includes('빌드') || kr.includes('전술')) {
        category = 'build';
      }

      // Smart Practice Type: Force 'B' if cloze is provided, or auto-detect
      const practiceType = (providedCloze || en.split(' ').length <= 4) ? 'B' : 'A';
      
      // Smart Cloze (Use provided or pick a word with > 4 chars)
      const words = en.replace(/[.,!?]/g, '').split(' ');
      const clozeTarget = providedCloze || words.find(w => w.length > 4) || words[0] || '';

      return {
        player_id: playerId,
        lesson_no: lessonNo,
        lesson_title_ko: lessonTitle,
        situation_order: 1, // Simplified for now
        situation_title_ko: situationTitle,
        item_order: idx + 1,
        category,
        practice_type: practiceType,
        prompt_kr: kr,
        target_en: en,
        cloze_target: practiceType === 'B' ? clozeTarget : '',
        expected_phrases: clozeTarget, // Default to cloze word as phrase
        max_latency_ms: maxLatency,
        notes: 'Smart Intake Generation',
        active: true
      };
    });

    setPreviewRows(rows);
  };

  const handleSaveToSheet = async () => {
    if (previewRows.length === 0) return;
    
    setLoading(true);
    setStatus({ type: 'pending', message: '질문 자동 매칭 중... 잠시만 기다려 주세요.' });

    try {
      const res = await fetch('/api/admin/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewRows })
      });

      if (!res.ok) throw new Error('Failed to append rows');
      const data = await res.json();

      const reviewMsg = data.review_needed > 0 ? ` (⚠️ ${data.review_needed}개 검토 필요)` : '';
      setStatus({ 
        type: 'success', 
        message: `✅ ${data.count}개 저장 완료! 질문 ${data.matched}개 자동 매칭${reviewMsg}` 
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };


  const handleSyncNow = async () => {
    setLoading(true);
    setStatus({ type: 'pending', message: 'Triggering System Sync...' });

    try {
      const res = await fetch('/api/admin/sync-content', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setStatus({ type: 'success', message: `Sync Complete! ${data.message}` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>🏟️ Smart Content Intake</div>
        <button onClick={() => router.push('/admin')} className={styles.secondaryButton}>
          Back to Admin
        </button>
      </header>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>
          <span>1.</span> Lesson Context
        </div>
        <div className={styles.grid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>선수 ID (player_id)</label>
            <input 
              className={styles.input} 
              value={playerId} 
              onChange={e => setPlayerId(e.target.value)} 
              placeholder="P001"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>레슨 번호 (lesson_no)</label>
            <input 
              type="number" 
              className={styles.input} 
              value={lessonNo} 
              onChange={e => setLessonNo(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>레슨 제목 (국문)</label>
            <input 
              className={styles.input} 
              value={lessonTitle} 
              onChange={e => setLessonTitle(e.target.value)} 
              placeholder="인터뷰 기초"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>상황 제목 (국문)</label>
            <input 
              className={styles.input} 
              value={situationTitle} 
              onChange={e => setSituationTitle(e.target.value)} 
              placeholder="경기 종료 후"
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>
          <span>2.</span> Fast Input (KR | EN | Cloze)
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '1rem', fontSize: '0.8rem' }}>
          `한국어 | 영어 | 빈칸단어` 형식으로 입력하세요. 빈칸단어가 없으면 AI가 자동으로 추천합니다.
        </p>
        <textarea
          className={styles.textarea}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="오늘 경기 어땠나요? | It was a tough game today. | tough &#10;다음 경기에 대한 각오는? | I will do my best to win. | best"
        />
      </div>

      {previewRows.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>
            <span>3.</span> AI Preview & Verification
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>No</th>
                  <th className={styles.th}>Category</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Prompt (KR)</th>
                  <th className={styles.th}>Target (EN)</th>
                  <th className={styles.th}>Cloze / Key</th>
                  <th className={styles.th}>Suggested Q</th>
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.item_order}>
                    <td className={styles.td}>{row.item_order}</td>
                    <td className={styles.td}>
                      <span className={`${styles.tag} ${styles[row.category + 'Tag']}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className={styles.td}>{row.practice_type}</td>
                    <td className={styles.td}>{row.prompt_kr}</td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>{row.target_en}</td>
                    <td className={styles.td} style={{ color: '#10b981' }}>{row.cloze_target}</td>
                    <td className={styles.td} style={{ fontSize: '0.78rem' }}>
                      {row.suggested_question_id ? (
                        <span style={{ color: row.review_needed ? '#f59e0b' : '#818cf8' }}>
                          {row.suggested_question_id}
                          {row.review_needed && ' ⚠️'}
                        </span>
                      ) : (
                        <span style={{ color: '#555' }}>—</span>
                      )}
                    </td>
                  </tr>

                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button 
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleSaveToSheet}
              disabled={loading}
            >
               💾 Save to Intake Sheet
            </button>
            <button 
              className={`${styles.button} ${styles.secondaryButton}`}
              style={{ background: '#6366f1' }}
              onClick={handleSyncNow}
              disabled={loading}
            >
               🔄 Sync System Now
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className={`${styles.statusBadge} ${styles['status' + (status.type === 'pending' ? 'Pending' : 'Success')]}`}>
          {status.type === 'pending' && <span className={styles.loadingDot}>...</span>}
          {status.message}
        </div>
      )}
    </div>
  );
}
