'use client';

import React, { useState, useEffect } from 'react';
import { getSupabase } from '@/utils/supabase';
import CardProgress from '@/components/CardProgress';
import styles from './home.module.css';

export default function HomePage() {
  const [profile, setProfile] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubTheme, setClubTheme] = useState<'tottenham' | 'mancity' | 'realmadrid'>('tottenham');

  const supabase = getSupabase();

  useEffect(() => {
    async function loadDashboard() {
      try {
        // 1. 대시보드 뷰 조회 (Profiles + Status 조인 뷰)
        const { data: dashboard, error: dbErr } = await supabase
          .from('player_dashboard')
          .select('*')
          .single();

        if (!dbErr && dashboard) {
          setProfile(dashboard);
        }
        // 세션 없을 시 게스트 모드로 표시 (로그인 불필요)

        // 2. 카드 컬렉션 조회
        const { data: collection, error: colErr } = await supabase
          .from('player_collection')
          .select('*');

        if (!colErr && collection) {
          setCards(collection);
        }
      } catch (err) {
        console.error('[Dashboard Load Error]:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>선수의 프로필 데이터를 불러오는 중...</p>
      </div>
    );
  }

  // 요일 매핑 텍스트
  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  // 롤모델 데이터 정의
  const roleModels = [
    { cardId: 'SONNY', name: '손흥민 (Sonny)', club: 'tottenham' },
    { cardId: 'HAALAND', name: '엘링 홀란드', club: 'mancity' },
    { cardId: 'PEP', name: '펩 과르디올라', club: 'mancity' }
  ];

  return (
    <div className={`${styles.container} ${styles[clubTheme]}`}>
      {/* 상단 엠블럼 캐비닛 & 테마 토글 */}
      <header className={styles.header}>
        <div className={styles.themeRow}>
          <button 
            type="button" 
            onClick={() => setClubTheme('tottenham')} 
            className={`${styles.themeBtn} ${clubTheme === 'tottenham' ? styles.themeBtnActive : ''}`}
          >
            ⚪ 토트넘
          </button>
          <button 
            type="button" 
            onClick={() => setClubTheme('mancity')} 
            className={`${styles.themeBtn} ${clubTheme === 'mancity' ? styles.themeBtnActive : ''}`}
          >
            🔵 맨시티
          </button>
          <button 
            type="button" 
            onClick={() => setClubTheme('realmadrid')} 
            className={`${styles.themeBtn} ${clubTheme === 'realmadrid' ? styles.themeBtnActive : ''}`}
          >
            🟡 레알
          </button>
        </div>

        <button type="button" onClick={handleLogout} className={styles.btnLogout}>
          로그아웃
        </button>
      </header>

      {/* 유저 OVR 상태 & XP 바 */}
      <section className={styles.statusSection}>
        <div className={styles.profileRow}>
          <div className={styles.avatar}>🎙️</div>
          <div className={styles.meta}>
            <h1 className={styles.displayName}>{profile?.display_name || '풋볼러'}</h1>
            <p className={styles.levelLabel}>LV. {profile?.level || 1} 국가대표 훈련병</p>
          </div>
        </div>

        {/* XP 프로그레스 바 */}
        <div style={{ width: '100%', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
            <span>경험치 (XP)</span>
            <span>{profile?.xp || 0} / {profile?.xp_to_next || 3000}</span>
          </div>
          <div className={styles.progressBarBg}>
            <div 
              className={styles.progressBarFill} 
              style={{ width: `${Math.round(((profile?.xp || 0) / (profile?.xp_to_next || 3000)) * 100)}%` }} 
            />
          </div>
        </div>
      </section>

      {/* 요일별 스트릭 캘린더 */}
      <section className={styles.streakSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>🔥 훈련 스트릭</span>
          <span style={{ color: '#fbbf24', fontWeight: 900 }}>{profile?.streak_days || 0}일 연속</span>
        </div>
        
        <div className={styles.streakGrid}>
          {weekDays.map((day, idx) => {
            const isChecked = profile?.streak_week ? profile.streak_week[idx] : false;
            return (
              <div key={day} className={styles.streakItem}>
                <span className={styles.streakDay}>{day}</span>
                <span className={`${styles.streakDot} ${isChecked ? styles.streakDotActive : ''}`}>
                  {isChecked ? '✓' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* FUT 선수 카드 컬렉션 */}
      <section className={styles.collectionSection}>
        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px' }}>🏆 롤 모델 선수 카드 보관함</h2>
        
        <div className={styles.cardsGrid}>
          {roleModels.map((model) => {
            const userCard = cards.find((c) => c.card_id === model.cardId);
            const pieceCount = userCard ? userCard.piece_count : 0;
            const unlocked = userCard ? userCard.unlocked : false;

            return (
              <CardProgress
                key={model.cardId}
                cardId={model.cardId}
                pieceCount={pieceCount}
                unlocked={unlocked}
                playerName={model.name}
              />
            );
          })}
        </div>
      </section>
      
      {/* 훈련하러 가기 플로팅 버튼 */}
      <div style={{ padding: '16px 20px', width: '100%', position: 'sticky', bottom: '0' }}>
        <button 
          type="button" 
          onClick={() => window.location.href = '/shorts'} 
          className={styles.btnTrain}
        >
          ⚽ 실전 영어 훈련 시작하기
        </button>
      </div>
    </div>
  );
}
