'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './ShortsMode.module.css';

interface ShortsModeProps {
  roleModel: string;
  addPieces: (cardId: string, amount: number) => void;
  updateXp: (amount: number) => void;
}

// Sample video assets and training expressions
const SHORTS_ITEMS = [
  {
    id: 'sonny-1',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-the-rain-31657-large.mp4',
    promptKr: '나한테 패스 찔러줘, 지금 침투하고 있어!',
    targetEn: "Feed me the ball, I'm making a run!",
    highlightStart: 1.5,
    highlightEnd: 4.5,
    nuanceDesc: "상대 수비 배후 공간을 빠르게 뚫고 들어갈 때 패스를 즉각 요구하는 축구 필드 필수 소통 영어입니다.",
    similarExpressions: ["Send it through!", "Pass it into space!"],
    subtype: 'match',
    position: 'FW',
    playerCardId: 'sonny',
    playerName: '손흥민',
  },
  {
    id: 'haaland-1',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-ball-in-the-net-31659-large.mp4',
    promptKr: '우리는 끝까지 엄청난 투지를 보여주고 싸웠습니다.',
    targetEn: "We showed great character and fought until the end.",
    highlightStart: 2.0,
    highlightEnd: 5.5,
    nuanceDesc: "경기 직후 공식 인터뷰에서 불리한 상황을 딛고 역전하거나 무승부를 거두었을 때 동료와 팀을 칭찬하는 품격 있는 인터뷰 관용구입니다.",
    similarExpressions: ["We never gave up.", "The team spirit was incredible."],
    subtype: 'interview',
    position: 'FW',
    playerCardId: 'haaland',
    playerName: '엘링 홀란드',
  },
  {
    id: 'pep-1',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kids-playing-soccer-in-a-field-31663-large.mp4',
    promptKr: '강도 높게 유지하고 상대 공간을 좁혀가자!',
    targetEn: "Keep the intensity high and close down the space!",
    highlightStart: 1.0,
    highlightEnd: 4.0,
    nuanceDesc: "감독이 훈련장이나 경기 직전 라커룸에서 선수단에게 빠른 압박과 밀집 수비를 주문할 때 가장 빈번하게 지시하는 전술 핵심 멘트입니다.",
    similarExpressions: ["Press them hard!", "Don't give them any time!"],
    subtype: 'training',
    position: 'MF',
    playerCardId: 'pep',
    playerName: '펩 과르디올라',
  }
];

export default function ShortsMode({ roleModel, addPieces, updateXp }: ShortsModeProps) {
  const [items, setItems] = useState(SHORTS_ITEMS);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Filter states
  const [situationFilter, setSituationFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  // Video playback & looping states
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const filteredItems = items.filter(item => {
    const matchSit = situationFilter === 'all' || item.subtype === situationFilter;
    const matchPos = positionFilter === 'all' || item.position === positionFilter;
    return matchSit && matchPos;
  });

  const currentItem = filteredItems[currentIndex];

  useEffect(() => {
    // Reset state on item change
    setPhase(1);
    setIsSaved(false);
    setShowExplanation(false);
    setIsPlaying(true);
    
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.0;
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, situationFilter, positionFilter]);

  // Video timeupdate tracking logic (3-step loop)
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentItem) return;
    const video = videoRef.current;
    
    const start = currentItem.highlightStart;
    const end = currentItem.highlightEnd;

    // Phase 1: Play standard speed (1.0x) whole video.
    // Phase 2: Loop highlight area at 0.7x speed.
    // Phase 3: Loop highlight area at 0.5x speed.
    if (phase === 2) {
      if (video.currentTime < start) {
        video.currentTime = start;
      }
      if (video.currentTime >= start && video.currentTime <= end) {
        video.playbackRate = 0.7;
      }
      if (video.currentTime > end) {
        setPhase(3);
        video.currentTime = start;
      }
    } else if (phase === 3) {
      if (video.currentTime < start) {
        video.currentTime = start;
      }
      if (video.currentTime >= start && video.currentTime <= end) {
        video.playbackRate = 0.5;
      }
      if (video.currentTime > end) {
        // Automatically scroll to next card after 3 loops
        handleNextCard();
      }
    }
  };

  const handleVideoEnded = () => {
    if (phase === 1) {
      setPhase(2);
      if (videoRef.current && currentItem) {
        videoRef.current.currentTime = currentItem.highlightStart;
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleNextCard = () => {
    if (filteredItems.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
  };

  const handlePrevCard = () => {
    if (filteredItems.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSave = () => {
    if (isSaved) return;
    setIsSaved(true);
    addPieces(currentItem.playerCardId, 1);
    updateXp(10);
    alert(`표현이 저장되어 [${currentItem.playerName}] 카드 조각 +1 획득! (+10 XP)`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'TAL Football English',
        text: `"${currentItem.targetEn}" - ${currentItem.playerName}의 축구 표현 배우기!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`"${currentItem.targetEn}" - ${currentItem.playerName}의 표현 학습!`);
      alert('공유 링크가 클립보드에 복사되었습니다.');
    }
  };

  const speakExplanation = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentItem.targetEn);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={styles.container}>
      {/* Dynamic Filters Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSelectWrap}>
          <select 
            value={situationFilter} 
            onChange={(e) => { setSituationFilter(e.target.value); setCurrentIndex(0); }}
            className={styles.filterSelect}
          >
            <option value="all">상황 전체</option>
            <option value="training">훈련장</option>
            <option value="match">경기중</option>
            <option value="interview">인터뷰</option>
          </select>
        </div>

        <div className={styles.filterSelectWrap}>
          <select 
            value={positionFilter} 
            onChange={(e) => { setPositionFilter(e.target.value); setCurrentIndex(0); }}
            className={styles.filterSelect}
          >
            <option value="all">포지션 전체</option>
            <option value="FW">공격수 (FW)</option>
            <option value="MF">미드필더 (MF)</option>
          </select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.noData}>
          <p>선택하신 조건에 맞는 영상 카드가 없습니다.</p>
        </div>
      ) : (
        <div className={styles.videoPlayerArea}>
          <video
            ref={videoRef}
            src={currentItem.videoUrl}
            className={styles.videoElement}
            loop={phase === 1} // Loop in phase 1, manually handle in phase 2/3
            muted
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onClick={togglePlay}
          />

          {!isPlaying && <div className={styles.pauseBtn} onClick={togglePlay}>▶</div>}

          {/* Repeat State Indicator */}
          <div className={styles.phaseIndicator}>
            {phase === 1 ? '🔥 1회차: 정상 속도' : phase === 2 ? '⚡ 2회차: 0.7x 반복' : '🚀 3회차: 0.5x 반복'}
          </div>

          {/* Right Action Sidebar */}
          <div className={styles.sidebarButtons}>
            <button className={`${styles.actionButton} ${isSaved ? styles.saved : ''}`} onClick={handleSave}>
              <span className={styles.btnIcon}>♥</span>
              <span className={styles.btnLabel}>저장</span>
            </button>
            <button className={styles.actionButton} onClick={handleShare}>
              <span className={styles.btnIcon}>→</span>
              <span className={styles.btnLabel}>공유</span>
            </button>
            <button className={styles.actionButton} onClick={() => { setShowExplanation(true); speakExplanation(); }}>
              <span className={styles.btnIcon}>ℹ</span>
              <span className={styles.btnLabel}>설명</span>
            </button>
          </div>

          {/* Bottom Captions Overlay */}
          <div className={styles.captionBox}>
            <div className={styles.playerMeta}>
              <span className={styles.playerName}>{currentItem.playerName}</span>
              <span className={styles.positionBadge}>{currentItem.position}</span>
            </div>
            
            <p className={styles.englishSubtitle}>
              {currentItem.targetEn.split(' ').map((word, i) => {
                // simple highlight logic
                const isHighlight = i < 4; // Mocking highlight of first few words
                return (
                  <span key={i} className={isHighlight ? styles.highlightWord : ''}>
                    {word}{' '}
                  </span>
                );
              })}
            </p>
          </div>

          {/* Navigation overlay */}
          <div className={styles.navControls}>
            <button className={styles.navBtn} onClick={handlePrevCard}>▲</button>
            <span className={styles.cardCounter}>{currentIndex + 1}/{filteredItems.length}</span>
            <button className={styles.navBtn} onClick={handleNextCard}>▼</button>
          </div>
        </div>
      )}

      {/* Explanation Dialog Popover */}
      {showExplanation && currentItem && (
        <div className={styles.explanationModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>표현 뉘앙스 해설</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowExplanation(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.targetSentence} onClick={speakExplanation}>
                🔊 "{currentItem.targetEn}"
              </p>
              
              <div className={styles.descSection}>
                <strong>어떤 상황에서 쓸까?</strong>
                <p className={styles.descText}>{currentItem.promptKr}</p>
                <p className={styles.descTextDetail}>{currentItem.nuanceDesc}</p>
              </div>

              <div className={styles.similarSection}>
                <strong>유사 축구 표현:</strong>
                <ul className={styles.similarList}>
                  {currentItem.similarExpressions.map((exp, idx) => (
                    <li key={idx}>⚽ {exp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
