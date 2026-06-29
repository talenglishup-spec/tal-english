'use client';

import React, { useState, useEffect } from 'react';
import { useYouTubePlayer, PlaybackStage, nextStage } from '../hooks/useYouTubePlayer';
import SpeakOverlay from './SpeakOverlay';
import XPToast from './XPToast';
import styles from '../app/shorts/ShortsPage.module.css';

interface ClipItem {
  clip_id: string;
  youtube_url: string;
  player_name: string;
  position_tag: string;
  subtype: string;
  target_phrase: string;
  nuance_desc: string;
  similar_expressions: string;
  speak_mode: boolean;
  pause_at: number;
}

interface ShortsPlayerProps {
  clip: ClipItem;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  playerId: string | null; // RLS 로깅용 유저 ID
}

export default function ShortsPlayer({ clip, isActive, onNext, onPrev, isFirst, isLast, playerId }: ShortsPlayerProps) {
  const [showNuance, setShowNuance] = useState(false);
  const [showSpeakOverlay, setShowSpeakOverlay] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // 자동재생 브라우저 정책용 음소거 유무
  const [xpToastVisible, setXpToastVisible] = useState(false);

  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /[?&]v=([^?&]+)/,
    /\/shorts\/([^?&]+)/,
  ];
  let videoId = '';
  for (const re of patterns) {
    const m = clip.youtube_url.match(re);
    if (m) {
      videoId = m[1];
      break;
    }
  }

  const {
    containerRef,
    isReady,
    stage,
    setStage,
    play,
    pause,
    seekTo,
    speakTriggered,
    resumeAfterSpeak,
    unMute,
    destroyPlayer
  } = useYouTubePlayer({
    videoId,
    pauseAt: clip.speak_mode ? clip.pause_at : 0,
    startAt: Math.max(0, clip.pause_at - 2.0),
    endAt: clip.pause_at + 2.0,
    autoplay: true, // 자동재생 활성화
    muted: true,    // 자동재생 정책 우회 위해 muted로 시작
    onSpeakTrigger: () => {
      setShowSpeakOverlay(true);
    },
    onStateChange: (state) => {
      if (state === 0 && stage === 1) {
        const start = Math.max(0, clip.pause_at - 2.0);
        seekTo(start);
        setStage(2);
        setTimeout(() => play(), 150);
      }
    }
  });

  useEffect(() => {
    if (!isActive) {
      destroyPlayer();
      setShowSpeakOverlay(false);
      setShowNuance(false);
      setIsMuted(true);
    }
  }, [isActive, destroyPlayer]);

  // 첫 탭 터치 시 소리 켜기 (Unmute) 처리
  const handleUnmute = () => {
    unMute();
    setIsMuted(false);
    play();
  };

  const handleOpenNuance = () => {
    pause();
    setShowNuance(true);
  };

  const handleCloseNuance = () => {
    setShowNuance(false);
    play();
  };

  // 스픽 챌린지 성공 시 API 연동 (Gamification)
  const handleSpeakSuccess = async (passed: boolean) => {
    setShowSpeakOverlay(false);
    resumeAfterSpeak();

    if (passed && playerId) {
      try {
        const res = await fetch('/api/train/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clip_id: clip.clip_id,
            card_id: clip.player_name // SONNY, HAALAND, PEP 등
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // XPToast 활성화
            setXpToastVisible(true);
          }
        }
      } catch (err) {
        console.error('[Complete API Trigger Error]:', err);
      }
    }

    if (stage === 1) {
      setStage(2);
    }
  };

  const handleSpeakSkip = () => {
    setShowSpeakOverlay(false);
    resumeAfterSpeak();
    if (stage === 1) {
      setStage(2);
    }
  };

  return (
    <div className={styles.card} style={{ position: 'relative' }}>
      {/* ⚡ XPToast ⚡ */}
      <XPToast 
        xp={50} 
        visible={xpToastVisible} 
        onClose={() => setXpToastVisible(false)} 
      />

      <div className={styles.cardHeader}>
        <div className={styles.playerMeta}>
          <span className={styles.playerName}>{clip.player_name}</span>
          <span className={styles.playerPosition}>{clip.position_tag}</span>
        </div>
        <span className={styles.subtypeBadge}>{clip.subtype.replace('_', ' ')}</span>
      </div>

      <div className={styles.videoBox}>
        <div ref={containerRef} className={styles.videoIframeContainer} />
        
        {/* 🔊 자동재생 음소거 첫 탭 Unmute 가이드 오버레이 */}
        {isReady && isMuted && (
          <div 
            onClick={handleUnmute} 
            style={unmuteOverlayStyle}
          >
            <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔊</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px' }}>
              선수 소리 켜기 (화면을 탭하세요)
            </span>
          </div>
        )}

        {showSpeakOverlay && (
          <SpeakOverlay
            targetPhrase={clip.target_phrase}
            clipId={clip.clip_id}
            onClose={handleSpeakSuccess}
            onSkip={handleSpeakSkip}
          />
        )}
      </div>

      <div className={styles.playbackBar}>
        <div className={styles.stagesRow}>
          <span className={styles.stageIndicator}>
            <span className={`${styles.dot} ${stage === 1 ? styles.dotActive : ''}`} />
            <span className={stage === 1 ? styles.stageTextActive : ''}>1단계(1.0x)</span>
          </span>
          <span className={styles.stageIndicator}>
            <span className={`${styles.dot} ${stage === 2 ? styles.dotActive : ''}`} />
            <span className={stage === 2 ? styles.stageTextActive : ''}>2단계(0.75x)</span>
          </span>
          <span className={styles.stageIndicator}>
            <span className={`${styles.dot} ${stage === 3 ? styles.dotActive : ''}`} />
            <span className={stage === 3 ? styles.stageTextActive : ''}>3단계(0.5x)</span>
          </span>
        </div>

        <p className={styles.phraseText}>
          {stage > 1 ? clip.target_phrase : '???'}
        </p>
      </div>

      <div className={styles.actionsRow}>
        <button type="button" onClick={handleOpenNuance} className={styles.btnInfo}>
          ℹ️ 뉘앙스
        </button>
        
        <button 
          type="button" 
          onClick={() => setStage(nextStage(stage))} 
          className={styles.btnInfo}
        >
          🔁 배속 전환
        </button>
      </div>

      <div className={styles.navigatorRow}>
        <button type="button" onClick={onPrev} disabled={isFirst} className={styles.navButton}>
          ← 이전 영상
        </button>
        <button type="button" onClick={onNext} disabled={isLast} className={styles.navButton}>
          다음 영상 →
        </button>
      </div>

      {showNuance && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>📢 표현 뉘앙스</h3>
            <p className={styles.modalDesc}>{clip.nuance_desc}</p>
            
            <div className={styles.modalExpressions}>
              <span className={styles.modalExpLabel}>원어민 유사 표현</span>
              <span className={styles.modalExpText}>{clip.similar_expressions}</span>
            </div>

            <button type="button" onClick={handleCloseNuance} className={styles.btnModalClose}>
              돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const unmuteOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(11, 15, 25, 0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 10,
  color: 'white',
  animation: 'fadeIn 0.3s ease-out'
};
