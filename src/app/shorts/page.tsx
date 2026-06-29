'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ShortsPlayer from '@/components/ShortsPlayer';
import styles from './ShortsPage.module.css';

export default function ShortsPage() {
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadData() {
      try {
        // 1. 세션 식별
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setPlayerId(session.user.id);
        }

        // 2. 클립 데이터 가져오기
        const res = await fetch('/api/content/items?speak=1');
        const data = await res.json();
        setClips(data.items || []);
      } catch (err) {
        console.error('[ShortsPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  const filteredClips = clips.filter(clip => {
    if (activeTab === 'ALL') return true;
    return clip.subtype === activeTab;
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (currentIndex < filteredClips.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>영상 훈련 데이터를 읽고 있습니다...</p>
      </div>
    );
  }

  const currentClip = filteredClips[currentIndex];

  return (
    <div className={styles.container}>
      <div className={styles.tabFilter}>
        {['ALL', 'tactical', 'post_match', 'press_conference', 'training'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
          >
            {tab === 'ALL' ? '전체 보기' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <main className={styles.feedScroll}>
        {filteredClips.length > 0 ? (
          <ShortsPlayer
            key={currentClip.clip_id}
            clip={currentClip}
            isActive={true}
            onNext={handleNext}
            onPrev={handlePrev}
            isFirst={currentIndex === 0}
            isLast={currentIndex === filteredClips.length - 1}
            playerId={playerId}
          />
        ) : (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#64748b' }}>
            <p>이 훈련 카테고리에 해당하는 영상이 아직 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
