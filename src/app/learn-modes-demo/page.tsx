'use client';

import React, { useState, useEffect } from 'react';
import styles from './styles.module.css';

// Components
import ShortsMode from '@/components/learn-modes-demo/ShortsMode';
import SpeakMode from '@/components/learn-modes-demo/SpeakMode';
import DailyWorkout from '@/components/learn-modes-demo/DailyWorkout';
import CollectionBoard from '@/components/learn-modes-demo/CollectionBoard';

export default function LearnModesDemoPage() {
  const [activeTab, setActiveTab] = useState<'shorts' | 'speak' | 'daily' | 'collection'>('shorts');
  
  // Player state loaded from localStorage
  const [xp, setXp] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [roleModel, setRoleModel] = useState<string>('sonny');
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [unlockedCards, setUnlockedCards] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load player state on mount
  useEffect(() => {
    const savedXp = localStorage.getItem('tal_player_xp');
    const savedStreak = localStorage.getItem('tal_player_streak');
    const savedRoleModel = localStorage.getItem('tal_player_role_model');
    const savedPieces = localStorage.getItem('tal_player_pieces');
    const savedUnlocked = localStorage.getItem('tal_player_unlocked_cards');

    setXp(savedXp ? parseInt(savedXp, 10) : 120);
    setStreak(savedStreak ? parseInt(savedStreak, 10) : 3);
    setRoleModel(savedRoleModel || 'sonny');
    
    if (savedPieces) {
      try {
        setPieces(JSON.parse(savedPieces));
      } catch (e) {
        setPieces({ sonny: 8, haaland: 15, pep: 3 });
      }
    } else {
      const initialPieces = { sonny: 8, haaland: 15, pep: 3 };
      setPieces(initialPieces);
      localStorage.setItem('tal_player_pieces', JSON.stringify(initialPieces));
    }

    if (savedUnlocked) {
      try {
        setUnlockedCards(JSON.parse(savedUnlocked));
      } catch (e) {
        setUnlockedCards([]);
      }
    } else {
      setUnlockedCards([]);
      localStorage.setItem('tal_player_unlocked_cards', JSON.stringify([]));
    }

    setInitialized(true);
  }, []);

  // Sync helpers
  const updateXp = (amount: number) => {
    setXp((prev) => {
      const newVal = prev + amount;
      localStorage.setItem('tal_player_xp', newVal.toString());
      return newVal;
    });
  };

  const updateStreak = (newStreak: number) => {
    setStreak(newStreak);
    localStorage.setItem('tal_player_streak', newStreak.toString());
  };

  const addPieces = (playerCardId: string, amount: number) => {
    setPieces((prev) => {
      const current = prev[playerCardId] || 0;
      const updatedVal = Math.min(30, current + amount);
      const newPieces = { ...prev, [playerCardId]: updatedVal };
      localStorage.setItem('tal_player_pieces', JSON.stringify(newPieces));
      
      // Auto unlock when pieces reach 30
      if (updatedVal >= 30 && !unlockedCards.includes(playerCardId)) {
        setUnlockedCards((prevUnlocked) => {
          const nextUnlocked = [...prevUnlocked, playerCardId];
          localStorage.setItem('tal_player_unlocked_cards', JSON.stringify(nextUnlocked));
          return nextUnlocked;
        });
      }
      return newPieces;
    });
  };

  const selectRoleModel = (id: string) => {
    setRoleModel(id);
    localStorage.setItem('tal_player_role_model', id);
  };

  if (!initialized) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading Player Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Header info (Confidential Label + Player stats overlay) */}
      <header className={styles.headerPanel}>
        <h1 className={styles.logo}>
          ⚽ TAL App <span>Demo v1</span>
        </h1>
        <p className={styles.subtext}>
          학습 모드 v1 실시간 오디오 채점 및 게이미피케이션 체험 데모
        </p>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span>🏆</span> OVR XP: <span className={styles.statVal}>{xp}</span>
          </div>
          <div className={styles.statItem}>
            <span>🔥</span> Streak: <span className={styles.statVal}>{streak}일 연속</span>
          </div>
          <div className={styles.statItem}>
            <span>👤</span> 롤 모델: <span className={styles.statVal} style={{ color: '#10b981' }}>{roleModel === 'sonny' ? '손흥민' : roleModel === 'haaland' ? '홀란드' : '펩'}</span>
          </div>
        </div>
      </header>

      {/* Main Simulation Phone Frame */}
      <div className={styles.phoneFrame}>
        <div className={styles.phoneNotch} />
        
        <div className={styles.phoneScreen}>
          <div className={styles.contentArea}>
            {activeTab === 'shorts' && (
              <ShortsMode 
                roleModel={roleModel} 
                addPieces={addPieces}
                updateXp={updateXp}
              />
            )}
            {activeTab === 'speak' && (
              <SpeakMode 
                updateXp={updateXp}
              />
            )}
            {activeTab === 'daily' && (
              <DailyWorkout 
                streak={streak} 
                updateStreak={updateStreak}
                updateXp={updateXp} 
                addPieces={addPieces}
                roleModel={roleModel}
              />
            )}
            {activeTab === 'collection' && (
              <CollectionBoard 
                pieces={pieces} 
                unlockedCards={unlockedCards} 
                roleModel={roleModel}
                selectRoleModel={selectRoleModel}
                addPieces={addPieces}
              />
            )}
          </div>

          {/* Persistent Bottom Nav Bar */}
          <nav className={styles.bottomNav}>
            <button
              className={`${styles.navItem} ${activeTab === 'shorts' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('shorts')}
            >
              <span className={styles.navIcon}>📺</span>
              <span className={styles.navLabel}>쇼츠 모드</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'speak' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('speak')}
            >
              <span className={styles.navIcon}>🎙️</span>
              <span className={styles.navLabel}>스픽 모드</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'daily' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <span className={styles.navIcon}>📅</span>
              <span className={styles.navLabel}>하루 끝내기</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'collection' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('collection')}
            >
              <span className={styles.navIcon}>🃏</span>
              <span className={styles.navLabel}>컬렉션</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
