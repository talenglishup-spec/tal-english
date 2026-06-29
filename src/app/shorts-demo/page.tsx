'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './styles.module.css';

// 숏폼 비디오 샘플 데이터
const SHORTS_DATA = [
  {
    id: 1,
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-the-rain-31657-large.mp4',
    title: '비 오는 날의 침투 패스 상황 🌧️',
    english: "Feed me the ball, I'm making a run!",
    korean: '나한테 패스 찔러줘, 지금 침투하고 있어!',
    player: '엘링 홀란드 (Erling Haaland)',
    packName: '홀란드 패키지 ⚡',
    difficulty: 'Easy',
  },
  {
    id: 2,
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-ball-in-the-net-31659-large.mp4',
    title: '경기 종료 직전 극적인 결승골 상황 ⚽',
    english: "We showed great character and fought until the end.",
    korean: '우리는 엄청난 투지를 보여주었고 끝까지 싸웠습니다.',
    player: '손흥민 (Son Heung-min)',
    packName: '손흥민 패키지 👑',
    difficulty: 'Medium',
  },
  {
    id: 3,
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kids-playing-soccer-in-a-field-31663-large.mp4',
    title: '강력한 팀 압박 전술 지시 🗣️',
    english: "Keep the intensity high and close down the space!",
    korean: '강도 높게 유지하고 상대 공간을 좁혀가자!',
    player: '펩 과르디올라 (Pep Guardiola)',
    packName: '전술가 펩 패키지 🧠',
    difficulty: 'Hard',
  }
];

// 랭킹 샘플 데이터
const RANKING_DATA = {
  personal: [
    { rank: 1, name: '김민재 (동북고)', score: 9850, isMe: false, badge: '👑' },
    { rank: 2, name: '이강인 (현대고)', score: 9240, isMe: false },
    { rank: 3, name: '박지성 (동북고)', score: 8900, isMe: false },
    { rank: 4, name: '나 (축구부 새내기)', score: 7850, isMe: true, rating: 'Gold IV' },
    { rank: 5, name: '황희찬 (풍생고)', score: 7600, isMe: false },
  ],
  schools: [
    { rank: 1, name: '동북고등학교 축구부', avgScore: 8850, count: 28 },
    { rank: 2, name: '현대고등학교 축구부', avgScore: 8620, count: 32 },
    { rank: 3, name: '풍생고등학교 축구부', avgScore: 8100, count: 25 },
    { rank: 4, name: '부경고등학교 축구부', avgScore: 7950, count: 22 },
  ]
};

// 카드 팩 정보
const CARD_PACKS = [
  {
    id: 'sonny',
    name: '손흥민 캡틴 팩',
    price: 300,
    color: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
    borderColor: '#ff2a5f',
    desc: '팀을 이끄는 리더십과 자신감 넘치는 인터뷰 표현',
    cards: [
      { english: "We showed great character.", korean: "우리는 훌륭한 투지를 보여줬어요." },
      { english: "It's an honor to captain this side.", korean: "이 팀의 주장을 맡게 되어 영광입니다." },
      { english: "We keep pushing forward.", korean: "우리는 계속해서 앞으로 나아갑니다." }
    ]
  },
  {
    id: 'haaland',
    name: '홀란드 비스트 팩',
    price: 300,
    color: 'linear-gradient(135deg, #00c6ff, #0072ff)',
    borderColor: '#00b0ff',
    desc: '피치 위에서 폭발적인 에너지를 내뿜는 실전 멘트',
    cards: [
      { english: "Feed me the ball!", korean: "나한테 볼 찔러줘!" },
      { english: "What a peach of a pass!", korean: "정말 기막힌 패스였어!" },
      { english: "We are hungry for more goals.", korean: "우리는 더 많은 골을 갈망합니다." }
    ]
  },
  {
    id: 'pep',
    name: '전술가 펩 마스터 팩',
    price: 500,
    color: 'linear-gradient(135deg, #f9d423, #ff4e50)',
    borderColor: '#ffb900',
    desc: '하프 스페이스 장악 등 지능적인 팀 전술 대화',
    cards: [
      { english: "Exploit the half-space!", korean: "하프 스페이스를 공략해!" },
      { english: "Keep the possession at all costs.", korean: "어떻게든 점유율을 유지해." },
      { english: "React quicker on the transition!",
        korean: "수비/공격 전환 시 더 빠르게 반응해!" }
    ]
  }
];

export default function ShortsDemoPage() {
  const [activeTab, setActiveTab] = useState<'shorts' | 'daily' | 'cards' | 'ranking'>('shorts');
  const [shortsIndex, setShortsIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // 챌린지 녹음 상태 시뮬레이션
  const [challengeState, setChallengeState] = useState<'idle' | 'recording' | 'analyzing' | 'result'>('idle');
  const [aiScore, setAiScore] = useState<any>(null);
  
  // 포인트 상태
  const [userPoints, setUserPoints] = useState(1250);
  
  // 카드 팩 개봉 상태
  const [openedCard, setOpenedCard] = useState<any>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openedCardsList, setOpenedCardsList] = useState<any[]>([
    { name: '손흥민', english: "We showed great character.", korean: "우리는 훌륭한 투지를 보여줬어요.", grade: 'Legend', color: 'linear-gradient(135deg, #ffe066, #f59f00)' },
    { name: '홀란드', english: "Feed me the ball!", korean: "나한테 볼 찔러줘!", grade: 'Gold', color: 'linear-gradient(135deg, #e9ecef, #adb5bd)' }
  ]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 비디오 자동 재생 제어
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [shortsIndex, isPlaying, activeTab]);

  // 탭 변경 시 비디오 정지 처리
  useEffect(() => {
    if (activeTab !== 'shorts') {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }, [activeTab]);

  const handleNextShorts = () => {
    setChallengeState('idle');
    setShortsIndex((prev) => (prev + 1) % SHORTS_DATA.length);
  };

  const handlePrevShorts = () => {
    setChallengeState('idle');
    setShortsIndex((prev) => (prev - 1 + SHORTS_DATA.length) % SHORTS_DATA.length);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // 녹음 시뮬레이터
  const startRecording = () => {
    setChallengeState('recording');
    setTimeout(() => {
      setChallengeState('analyzing');
      setTimeout(() => {
        // 무작위 점수 생성
        const pace = Math.floor(Math.random() * 15) + 82; // 82~96
        const power = Math.floor(Math.random() * 20) + 78; // 78~97
        const accuracy = Math.floor(Math.random() * 15) + 85; // 85~99
        const ovr = Math.floor((pace + power + accuracy) / 3);
        
        let grade = 'Silver';
        if (ovr >= 92) grade = 'World Class';
        else if (ovr >= 87) grade = 'Gold';

        setAiScore({ pace, power, accuracy, ovr, grade });
        setChallengeState('result');
        setUserPoints(prev => prev + 50); // 보너스 포인트 지급
      }, 1800);
    }, 2500); // 2.5초간 녹음 중 상태 유지
  };

  // TTS 재생 시뮬레이션
  const speakEnglish = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  // 카드 팩 구매 시뮬레이션
  const buyCardPack = (pack: typeof CARD_PACKS[0]) => {
    if (userPoints < pack.price) {
      alert('포인트가 부족합니다! 피치 챌린지를 클리어해 포인트를 모아보세요.');
      return;
    }
    
    setIsOpening(true);
    setUserPoints(prev => prev - pack.price);

    // 무작위 카드 선택
    setTimeout(() => {
      const randomCard = pack.cards[Math.floor(Math.random() * pack.cards.length)];
      const grades = ['Rare', 'Epic', 'Legend'];
      const randomGrade = grades[Math.floor(Math.random() * grades.length)];
      
      let cardColor = 'linear-gradient(135deg, #ff9233, #ff5e62)';
      if (randomGrade === 'Legend') cardColor = 'linear-gradient(135deg, #ffe259, #ffa751)';
      else if (randomGrade === 'Rare') cardColor = 'linear-gradient(135deg, #3a7bd5, #3a6073)';

      const newCard = {
        name: pack.id === 'sonny' ? '손흥민' : pack.id === 'haaland' ? '홀란드' : '펩 과르디올라',
        english: randomCard.english,
        korean: randomCard.korean,
        grade: randomGrade,
        color: cardColor
      };

      setOpenedCard(newCard);
      setOpenedCardsList(prev => [newCard, ...prev]);
      setIsOpening(false);
    }, 1500);
  };

  const currentShort = SHORTS_DATA[shortsIndex];

  return (
    <div className={styles.container}>
      {/* 백그라운드 블러 레이어 */}
      <div className={styles.bgBlur} style={{ backgroundImage: `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1470&auto=format&fit=crop')` }}></div>

      {/* 헤더 & 앱 컨셉 안내 */}
      <div className={styles.headerPanel}>
        <h1 className={styles.logo}>⚽ TAL <span>App Redesign Prototype</span></h1>
        <p className={styles.subtext}>
          실제 스마트폰 웹 환경과 동일하게 구현된 시뮬레이터입니다. 각 탭을 누르거나 액션을 취해 보세요.
        </p>
        <div className={styles.pointIndicator}>
          내 보유 포인트: <span>🔥 {userPoints} TAL</span>
        </div>
      </div>

      {/* 스마트폰 목업 프레임 */}
      <div className={styles.phoneFrame}>
        <div className={styles.phoneNotch}></div>
        <div className={styles.phoneScreen}>
          
          {/* [1] 숏폼 비디오 탭 */}
          {activeTab === 'shorts' && (
            <div className={styles.shortsView}>
              <video
                ref={videoRef}
                src={currentShort.videoUrl}
                className={styles.shortsVideo}
                loop
                muted
                playsInline
                onClick={togglePlay}
              />
              
              {/* 우측 슬라이드 버튼 가이드 */}
              <div className={styles.navigationArrows}>
                <button className={styles.arrowBtn} onClick={handlePrevShorts}>▲</button>
                <span className={styles.arrowLabel}>{shortsIndex + 1}/{SHORTS_DATA.length}</span>
                <button className={styles.arrowBtn} onClick={handleNextShorts}>▼</button>
              </div>

              {/* 비디오 재생 상태 레이블 */}
              {!isPlaying && <div className={styles.pauseOverlay} onClick={togglePlay}>▶</div>}

              {/* 영상 자막 및 플레이어 정보 (글래스모피즘 오버레이) */}
              <div className={styles.shortsOverlay}>
                <span className={styles.packTag}>{currentShort.packName}</span>
                <h3 className={styles.shortsTitle}>{currentShort.title}</h3>
                <p className={styles.playerLabel}>By {currentShort.player}</p>

                <div className={styles.subtitleBox}>
                  <div className={styles.engText} onClick={() => speakEnglish(currentShort.english)}>
                    🔊 {currentShort.english}
                  </div>
                  <div className={styles.korText}>{currentShort.korean}</div>
                </div>

                {/* 챌린지 수행 인터페이스 영역 */}
                <div className={styles.challengeActionArea}>
                  {challengeState === 'idle' && (
                    <button className={styles.micBtn} onClick={startRecording}>
                      🎤 <span>이 표현 챌린지 도전하기</span>
                    </button>
                  )}

                  {challengeState === 'recording' && (
                    <div className={styles.pulseContainer}>
                      <div className={styles.pulseRing}></div>
                      <button className={styles.micBtnActive}>
                        🔴 <span>말하는 중... 훈련장처럼 크게 외치세요!</span>
                      </button>
                    </div>
                  )}

                  {challengeState === 'analyzing' && (
                    <div className={styles.loaderBox}>
                      <div className={styles.spinner}></div>
                      <p>AI가 발음과 자신감을 스캔하고 있습니다...</p>
                    </div>
                  )}

                  {challengeState === 'result' && aiScore && (
                    <div className={styles.resultCard}>
                      <div className={styles.resultHeader}>
                        <span className={styles.rankBadge}>{aiScore.grade}</span>
                        <h4>훈련 성공! <span>+50 TAL</span></h4>
                      </div>
                      
                      {/* 피파 카드 스탯 스타일 */}
                      <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                          <div className={styles.statVal}>{aiScore.accuracy}</div>
                          <div className={styles.statLbl}>ACC (일치율)</div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statVal}>{aiScore.pace}</div>
                          <div className={styles.statLbl}>PAC (말하기 속도)</div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statVal}>{aiScore.power}</div>
                          <div className={styles.statLbl}>PWR (데시벨/성량)</div>
                        </div>
                        <div className={`${styles.statItem} ${styles.ovrItem}`}>
                          <div className={styles.statVal}>{aiScore.ovr}</div>
                          <div className={styles.statLbl}>OVR (종합 스탯)</div>
                        </div>
                      </div>

                      <div className={styles.resultActions}>
                        <button className={styles.retryBtn} onClick={() => setChallengeState('idle')}>다시 도전</button>
                        <button className={styles.confirmBtn} onClick={handleNextShorts}>다음 훈련으로 ▶</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* [2] 오늘의 전술 탭 */}
          {activeTab === 'daily' && (
            <div className={styles.dailyView}>
              <div className={styles.dailyHeader}>
                <h2>📅 데일리 전술 훈련</h2>
                <p>매일 아침 전술판 브리핑을 통해 실전 영어 1문장을 습득하세요.</p>
              </div>

              <div className={styles.tacticsBoard}>
                {/* 축구 전술판 형태의 미니 컴포넌트 */}
                <div className={styles.fieldGrid}>
                  <div className={styles.penaltyArea}></div>
                  <div className={styles.centerCircle}></div>
                  {/* 플레이어 자석 칩 */}
                  <div className={`${styles.playerChip} ${styles.attacker}`} style={{ top: '25%', left: '40%' }}>9</div>
                  <div className={`${styles.playerChip} ${styles.midfielder}`} style={{ top: '55%', left: '30%' }}>17</div>
                  <div className={`${styles.playerChip} ${styles.defender}`} style={{ top: '65%', left: '75%' }}>4</div>
                  
                  {/* 패스 패스 화살표 점선 */}
                  <svg className={styles.passLine} viewBox="0 0 100 100">
                    <path d="M 30 55 C 40 40, 35 30, 40 25" stroke="#00ff66" strokeWidth="2" strokeDasharray="4" fill="none" />
                  </svg>
                </div>
                <div className={styles.tacticsInfo}>
                  <span className={styles.tacticsTag}>오늘의 전술 매치</span>
                  <h3>수비 배후 공간 침투 시 소통</h3>
                  <p className={styles.tacticsDesc}>"미드필더가 공을 잡고 고개를 들 때, 공격수는 즉시 외치고 달립니다."</p>
                </div>
              </div>

              <div className={styles.dailyChallengeBox}>
                <div className={styles.expressionText}>
                  "Exploit the half-space!"
                </div>
                <p className={styles.expressionTranslation}>"(상대의) 하프 스페이스 공간을 파고들어!"</p>
                
                <div className={styles.streakStatus}>
                  <h4>🔥 연속 전술 훈련 5일째 달성 중!</h4>
                  <div className={styles.streakDots}>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <span key={d} className={`${styles.streakDot} ${styles.completed}`}>✓</span>
                    ))}
                    {[6, 7].map((d) => (
                      <span key={d} className={styles.streakDot}>{d}</span>
                    ))}
                  </div>
                  <p className={styles.streakTip}>앞으로 2일 더 훈련하면 '전술가 펩 마스터 팩' 증정!</p>
                </div>

                <button className={styles.trainStartBtn} onClick={() => {
                  setActiveTab('shorts');
                  setShortsIndex(2); // 펩 과르디올라 영상으로 이동
                }}>
                  전술 비디오 보기 및 챌린지 시작
                </button>
              </div>
            </div>
          )}

          {/* [3] 카드 팩 상점 탭 */}
          {activeTab === 'cards' && (
            <div className={styles.cardsView}>
              <div className={styles.storeHeader}>
                <h2>🃏 마이 스쿼드 카드룸</h2>
                <p>챌린지로 획득한 TAL 포인트로 최정상 플레이어들의 표현 카드를 모으세요.</p>
              </div>

              {/* 스쿼드 메이킹 영역 시각화 */}
              <div className={styles.mySquadSection}>
                <h3>🛡️ 내 영어 스쿼드 베스트 11</h3>
                <div className={styles.squadPreview}>
                  <div className={styles.squadOvr}>스쿼드 OVR: <span>89</span></div>
                  <div className={styles.miniPitch}>
                    <div className={styles.pitchGoal}></div>
                    <div className={styles.squadPlayers}>
                      {/* 포지션 선수 카드 칩 */}
                      <div className={styles.squadPlayerCard} style={{ backgroundColor: '#ffe259' }}>
                        <div className={styles.squadPlayerGrade}>L</div>
                        <div className={styles.squadPlayerName}>손흥민</div>
                      </div>
                      <div className={styles.squadPlayerCard} style={{ backgroundColor: '#adb5bd' }}>
                        <div className={styles.squadPlayerGrade}>G</div>
                        <div className={styles.squadPlayerName}>홀란드</div>
                      </div>
                      <div className={styles.squadPlayerCardEmpty}>
                        <div className={styles.plusIcon}>+</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 상점 카드 팩 리스트 */}
              <div className={styles.packShopSection}>
                <h3>🎁 팩 상점 (Pack Store)</h3>
                <div className={styles.packList}>
                  {CARD_PACKS.map((pack) => (
                    <div key={pack.id} className={styles.packItem} style={{ borderLeft: `5px solid ${pack.borderColor}` }}>
                      <div className={styles.packInfo}>
                        <h4>{pack.name}</h4>
                        <p>{pack.desc}</p>
                      </div>
                      <button className={styles.packBuyBtn} onClick={() => buyCardPack(pack)}>
                        👛 {pack.price}P
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 카드 개봉 모달 (카드 획득 연출) */}
              {(isOpening || openedCard) && (
                <div className={styles.modalOverlay}>
                  {isOpening ? (
                    <div className={styles.openingAnimation}>
                      <div className={styles.shakingPack}>🎁</div>
                      <h3>카드 팩 개봉 중...</h3>
                      <p>전설적인 선수의 시그니처 훈련 카드가 들어있습니다!</p>
                    </div>
                  ) : (
                    <div className={styles.openedCardShow}>
                      <div className={styles.soccerCard} style={{ background: openedCard.color }}>
                        <div className={styles.cardHeaderInfo}>
                          <span className={styles.cardGrade}>{openedCard.grade}</span>
                          <span className={styles.cardPlayerName}>{openedCard.name}</span>
                        </div>
                        <div className={styles.cardBodyInfo}>
                          <div className={styles.cardExpression}>"{openedCard.english}"</div>
                          <div className={styles.cardTranslation}>{openedCard.korean}</div>
                        </div>
                        <div className={styles.cardFooterInfo}>TAL TRAINING CARD</div>
                      </div>
                      <h3>새로운 카드를 획득했습니다!</h3>
                      <button className={styles.modalCloseBtn} onClick={() => setOpenedCard(null)}>내 카드에 보관하기</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* [4] 라커룸 리그 탭 */}
          {activeTab === 'ranking' && (
            <div className={styles.rankingView}>
              <div className={styles.rankingHeader}>
                <h2>🏆 라커룸 리그</h2>
                <p>이번 주 챌린지 점수를 모아 전국 최고의 영어 플레이어로 데뷔하세요!</p>
              </div>

              {/* 랭킹 토글 */}
              <div className={styles.rankingTabs}>
                <button className={styles.rankingTabBtnActive}>개인 리그 (골드)</button>
                <button className={styles.rankingTabBtn}>학교 축구부 랭킹</button>
              </div>

              {/* 리더보드 */}
              <div className={styles.leaderboard}>
                {RANKING_DATA.personal.map((p) => (
                  <div key={p.rank} className={`${styles.rankItem} ${p.isMe ? styles.rankMe : ''}`}>
                    <div className={styles.rankNum}>{p.rank}</div>
                    <div className={styles.rankName}>
                      {p.name} {p.badge && <span className={styles.rankBadgeIcon}>{p.badge}</span>}
                      {p.rating && <span className={styles.rankTier}>{p.rating}</span>}
                    </div>
                    <div className={styles.rankScore}>{p.score.toLocaleString()}P</div>
                  </div>
                ))}
              </div>

              {/* 시즌 종료 타이머 및 학교 보상 안내 */}
              <div className={styles.seasonInfoBox}>
                <div className={styles.seasonTimer}>
                  ⏱️ 주간 리그 종료까지: <span>1일 14시간</span>
                </div>
                <div className={styles.seasonRewardCard}>
                  <h4>이번 시즌 우승 혜택 🥇</h4>
                  <p>전국 1위 학교 축구부 전체에 **코카콜라 & 파워에이드 2박스** 및 **그립삭스 30켤레** 현장 배송!</p>
                  <p className={styles.rewardLead}>현재 1위: <strong>동북고등학교 축구부</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* 하단 탭 바 (Bottom Navigation) */}
          <div className={styles.bottomNav}>
            <button
              className={`${styles.navItem} ${activeTab === 'shorts' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('shorts')}
            >
              <span className={styles.navIcon}>📺</span>
              <span className={styles.navLabel}>숏폼 피드</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'daily' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <span className={styles.navIcon}>📅</span>
              <span className={styles.navLabel}>전술 매치</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'cards' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('cards')}
            >
              <span className={styles.navIcon}>🃏</span>
              <span className={styles.navLabel}>카드룸</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'ranking' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('ranking')}
            >
              <span className={styles.navIcon}>🏆</span>
              <span className={styles.navLabel}>랭킹</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
