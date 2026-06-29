'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.module.css';

// 테스트용 축구 유튜브 비디오 및 표현 프리셋 데이터 (동영상 순서 및 특정 구간 정의)
const PRESETS = [
  {
    id: 'user-clip-1',
    title: 'Match Highlights 1 (경기 명장면 1)',
    youtubeVideoId: 'ro85pVBq9Xs',
    promptKr: '주변을 둘러봐!',
    targetEn: "Look around",
    startSeconds: 1.0,
    endSeconds: 5.0,
    pauseAt: 3.5, // 3.5초에 멈춤 후 스픽 시퀀스
    nuanceDesc: "경기 도중 볼을 잡거나 패스를 받기 전, 고개를 들어 주변의 팀원들과 수비수들의 포지션을 살피며 시야를 확보하라고 지시하는 필수 경기장 콜(Call)입니다.",
    situationName: '경기 중 주변 탐색',
    level: 1,
  },
  {
    id: 'user-clip-2',
    title: 'Match Highlights 2 (경기 명장면 2)',
    youtubeVideoId: 'ro85pVBq9Xs',
    promptKr: '뒤에 수비 붙었어!',
    targetEn: "Man on",
    startSeconds: 129.0,
    endSeconds: 132.0,
    pauseAt: 131.0, // 131.0초에 멈춤 후 스픽 시퀀스
    nuanceDesc: "공을 잡고 있는 동료 선수의 등 뒤로 상대편 수비수가 바짝 추격하며 강하게 압박하고 있음을 알리고 경고하기 위해 사용되는 매우 보편적이고 다급한 피치 영어입니다.",
    situationName: '압박 수비 대처',
    level: 2,
  }
];

import { notFound } from 'next/navigation';

export default function YoutubeTestPage() {
  // 프로덕션 환경 접근 차단 가드
  if (process.env.NODE_ENV !== 'development') {
    return notFound();
  }

  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1, 2]);
  const [isUnlockToastVisible, setIsUnlockToastVisible] = useState(false);

  // 현재 해금된 레벨 프리셋만 필터링
  const activePresets = PRESETS.filter(p => unlockedLevels.includes(p.level));

  const [activePresetId, setActivePresetId] = useState<string>(PRESETS[0].id);
  const activePresetIdRef = useRef<string>(PRESETS[0].id);

  useEffect(() => {
    activePresetIdRef.current = activePresetId;
  }, [activePresetId]);

  // 레벨 해금 안내 토스트 자동 닫힘 타이머
  useEffect(() => {
    if (isUnlockToastVisible) {
      const timer = setTimeout(() => {
        setIsUnlockToastVisible(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isUnlockToastVisible]);

  const [isApiReady, setIsApiReady] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'shorts' | 'speak' | 'oneday' | 'collection'>('shorts');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<'tottenham' | 'mancity' | 'realmadrid'>('tottenham');

  // 스픽 모드 탭 전용 챌린지 상태
  const [speakTabState, setSpeakTabState] = useState<'idle' | 'recording' | 'analyzing' | 'result'>('idle');
  const [speakTabScore, setSpeakTabScore] = useState<number>(0);
  const [speakTabTranscription, setSpeakTabTranscription] = useState<string>('');

  // 5단계 스피킹 시퀀스 관련 상태
  const [speakSeqSteps, setSpeakSeqSteps] = useState<{ [presetId: string]: number }>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [seqResult, setSeqResult] = useState<{ [presetId: string]: 'pass' | 'fail' | null }>({});
  const [seqDoneThisPhase, setSeqDoneThisPhase] = useState<{ [key: string]: boolean }>({});

  const activeCountdownIntervalRef = useRef<any>(null);
  const activeRecordIntervalRef = useRef<any>(null);

  // 첫 화면 클릭 시 음소거를 풀어주는 이벤트 핸들러 (유튜브 자동재생 정책 대응)
  const handleGlobalInteraction = () => {
    if (hasInteracted) return;
    setHasInteracted(true);
    const player = playerRefs.current[activePresetIdRef.current];
    if (player && player.unMute) {
      try {
        player.unMute();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 모드 변경 시 비디오 정지 제어
  useEffect(() => {
    if (activeTab !== 'shorts') {
      stopMonitoring();
      PRESETS.forEach((preset) => {
        const player = playerRefs.current[preset.id];
        if (player && player.pauseVideo) {
          try {
            player.pauseVideo();
          } catch (e) {}
        }
      });
      setIsPlaying(false);
    } else {
      // 다시 쇼츠 모드로 돌아왔을 때 현재 활성화된 영상 재생 재개
      const player = playerRefs.current[activePresetIdRef.current];
      if (player && player.playVideo) {
        try {
          player.unMute();
          player.playVideo();
          setIsPlaying(true);
        } catch (e) {}
      }
    }
  }, [activeTab]);
  
  // 각 비디오 카드별 학습 진행 상태를 딕셔너리로 관리
  const [phases, setPhases] = useState<Record<string, 1 | 2 | 3 | 'speak'>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 1 }), {})
  );
  
  // 각 카드별 재생 속도 및 현재 재생 타임 감지
  const [playbackRates, setPlaybackRates] = useState<Record<string, number>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 1.0 }), {})
  );
  const [currentTimes, setCurrentTimes] = useState<Record<string, number>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
  );

  // 각 카드별 스픽 상태 및 가상 Whisper STT 결과 상태 관리
  const [speakStates, setSpeakStates] = useState<Record<string, 'idle' | 'recording' | 'analyzing' | 'result'>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 'idle' }), {})
  );
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: '' }), {})
  );
  const [scores, setScores] = useState<Record<string, number>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
  );
  const [successCounts, setSuccessCounts] = useState<Record<string, number>>(
    PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
  );

  // 다중 유튜브 플레이어 관리 레퍼런스
  const playerRefs = useRef<Record<string, any>>({});
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScrollingRef = useRef<boolean>(false);

  // 1. TAL Design Spec 폰트 동적 로드 (Manrope & Pretendard)
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const linkPretendard = document.createElement('link');
    linkPretendard.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
    linkPretendard.rel = 'stylesheet';
    document.head.appendChild(linkPretendard);

    return () => {
      try {
        document.head.removeChild(link);
        document.head.removeChild(linkPretendard);
      } catch (e) {}
    };
  }, []);

  // 2. YouTube IFrame API 스크립트 동적 로드
  useEffect(() => {
    if (window.YT) {
      setIsApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      setIsApiReady(true);
    };

    return () => {
      (window as any).onYouTubeIframeAPIReady = null;
      if (activeCountdownIntervalRef.current) clearInterval(activeCountdownIntervalRef.current);
      if (activeRecordIntervalRef.current) clearInterval(activeRecordIntervalRef.current);
    };
  }, []);

  // 3. 다중 유튜브 플레이어 동적 바인딩
  useEffect(() => {
    if (!isApiReady) return;

    PRESETS.forEach((preset) => {
      const elementId = `youtube-player-${preset.id}`;
      
      // 이미 초기화된 플레이어가 있다면 패스
      if (playerRefs.current[preset.id]) return;

      playerRefs.current[preset.id] = new (window as any).YT.Player(elementId, {
        videoId: preset.youtubeVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.mute(); 
            event.target.seekTo(preset.startSeconds, true);
            
            // 첫 번째 영상의 경우 로딩 즉시 재생 준비 (음소거 상태로 재생 시도하여 유튜브 큰 재생 버튼 생성 방지. 단, 해금 상태여야 함)
            if (preset.id === activePresetId && unlockedLevels.includes(preset.level)) {
              setTimeout(() => {
                event.target.mute();
                event.target.seekTo(preset.startSeconds, true);
                setTimeout(() => {
                  try {
                    event.target.playVideo();
                    setIsPlaying(true);
                  } catch(e){}
                }, 150);
              }, 1000);
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            if (preset.id === activePresetId) {
              if (state === (window as any).YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                startMonitoring(preset.id);
              } else if (state === (window as any).YT.PlayerState.PAUSED || 
                         state === (window as any).YT.PlayerState.ENDED) {
                setIsPlaying(false);
              }
            }
          }
        }
      });
    });

    return () => {
      stopMonitoring();
    };
  }, [isApiReady]);

  // 4. 세로 스크롤 스냅 감지 (Intersection Observer)
  useEffect(() => {
    if (!containerRef.current) return;

    const observerOptions = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.6, // 카드의 60% 이상이 노출되면 활성화 감지
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const presetId = entry.target.getAttribute('data-preset-id');
          if (presetId && presetId !== activePresetIdRef.current) {
            handlePresetTransition(presetId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // 프리셋 카드를 모두 관찰 대상으로 등록
    PRESETS.forEach((preset) => {
      const el = document.getElementById(`card-${preset.id}`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // 5. 영상 전환 시 비디오 재생 통제
  const handlePresetTransition = (nextPresetId: string) => {
    stopMonitoring();

    // 1. 활성화 영상 외 모든 비디오 정지 및 되감기 (소리 겹침 방지 안전장치)
    PRESETS.forEach((preset) => {
      if (preset.id !== nextPresetId) {
        const prevPlayer = playerRefs.current[preset.id];
        if (prevPlayer && prevPlayer.pauseVideo) {
          try {
            prevPlayer.pauseVideo();
            prevPlayer.seekTo(preset.startSeconds, true);
          } catch (e) {
            console.error(e);
          }
        }
      }
    });

    // 2. 상태 초기화
    setActivePresetId(nextPresetId);
    setPhases(prev => ({ ...prev, [nextPresetId]: 1 }));
    setPlaybackRates(prev => ({ ...prev, [nextPresetId]: 1.0 }));
    setSpeakStates(prev => ({ ...prev, [nextPresetId]: 'idle' }));
    setScores(prev => ({ ...prev, [nextPresetId]: 0 }));
    setTranscriptions(prev => ({ ...prev, [nextPresetId]: '' }));

    // 3. 새 비디오 재생 (단, 해금된 레벨 상황일 때만 재생 진행)
    const nextPlayer = playerRefs.current[nextPresetId];
    const nextPreset = PRESETS.find(p => p.id === nextPresetId);
    if (nextPlayer && nextPlayer.playVideo && nextPreset && unlockedLevels.includes(nextPreset.level)) {
      try {
        nextPlayer.unMute();
        nextPlayer.seekTo(nextPreset.startSeconds, true);
        
        // 유튜브 seekTo와 playVideo 간의 타임스탬프 씹힘 레이스 컨디션 방지용 150ms 딜레이 후 play 개시
        setTimeout(() => {
          try {
            nextPlayer.playVideo();
            setIsPlaying(true);
          } catch(err){}
        }, 150);
      } catch (e) {
        console.error(e);
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
      if (nextPlayer && nextPlayer.pauseVideo) {
        try { nextPlayer.pauseVideo(); } catch(e){}
      }
    }
  };

  // 6. 50ms 미세 타임스탬프 감지
  const startMonitoring = (presetId: string) => {
    stopMonitoring();

    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    monitorIntervalRef.current = setInterval(() => {
      const player = playerRefs.current[presetId];
      if (!player || !player.getCurrentTime) return;

      const currTime = player.getCurrentTime();
      setCurrentTimes(prev => ({ ...prev, [presetId]: currTime }));

      const start = preset.startSeconds;
      const end = preset.endSeconds;
      const pauseAt = preset.pauseAt || (start + (end - start) * 0.7);
      const currentPhase = phases[presetId] || 1;
      const phaseKey = `${presetId}_${currentPhase}`;

      // 1. 현재 재생 시간이 pauseAt을 지났고, 스픽 탭 모드일 때 이번 배속 페이즈에서 아직 스픽 시퀀스를 하지 않았다면 일시정지 후 시퀀스 실행
      if (activeTab === 'speak' && currTime >= pauseAt && !seqDoneThisPhase[phaseKey] && (!speakSeqSteps[presetId] || speakSeqSteps[presetId] === 0)) {
        stopMonitoring();
        player.pauseVideo();
        setIsPlaying(false);
        triggerSpeakSequence(presetId, Number(currentPhase));
        return;
      }

      // Advanced 모드 2회차 하이라이트 시작 0.1초 전 자동 멈춤
      if (isAdvanced && currentPhase === 2) {
        const autoPauseThreshold = start - 0.1;
        if (currTime >= autoPauseThreshold) {
          player.pauseVideo();
          setIsPlaying(false);
          setPhases(prev => ({ ...prev, [presetId]: 'speak' }));
          setSpeakStates(prev => ({ ...prev, [presetId]: 'idle' }));
          return;
        }
      }

      // 일반 Phase 감속 루프 제어
      if (currentPhase === 1) {
        player.setPlaybackRate(1.0);
        setPlaybackRates(prev => ({ ...prev, [presetId]: 1.0 }));

        if (currTime >= end) {
          setPhases(prev => ({ ...prev, [presetId]: 2 }));
          player.seekTo(start, true);
          setTimeout(() => {
            player.setPlaybackRate(0.75);
            setPlaybackRates(prev => ({ ...prev, [presetId]: 0.75 }));
          }, 100);
        }
      } 
      else if (currentPhase === 2 && !isAdvanced) {
        player.setPlaybackRate(0.75);
        setPlaybackRates(prev => ({ ...prev, [presetId]: 0.75 }));

        if (currTime < start) {
          player.seekTo(start, true);
        }

        if (currTime >= end) {
          setPhases(prev => ({ ...prev, [presetId]: 3 }));
          player.seekTo(start, true);
          setTimeout(() => {
            player.setPlaybackRate(0.5);
            setPlaybackRates(prev => ({ ...prev, [presetId]: 0.5 }));
          }, 100);
        }
      } 
      else if (currentPhase === 3) {
        player.setPlaybackRate(0.5);
        setPlaybackRates(prev => ({ ...prev, [presetId]: 0.5 }));

        if (currTime < start) {
          player.seekTo(start, true);
        }

        if (currTime >= end) {
          stopMonitoring();
          player.pauseVideo();
          setIsPlaying(false);
          
          if (activeTab === 'speak') {
            // 스픽 모드는 3단계 감속 루프 최종 종료 시 다음 비디오로 스냅
            handleNextScroll(presetId);
          } else {
            // 쇼츠 모드는 단순히 첫 배속으로 리와인드하여 루프 재생 (정지하지 않고 계속 감상 가능하도록)
            player.seekTo(start, true);
            setPhases(prev => ({ ...prev, [presetId]: 1 }));
            player.setPlaybackRate(1.0);
            setPlaybackRates(prev => ({ ...prev, [presetId]: 1.0 }));
            startMonitoring(presetId);
          }
        }
      }
    }, 50);
  };

  const stopMonitoring = () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  };

  // 상단 탭 탭 시 특정 카드로 부드러운 스크롤 이동
  const scrollToPreset = (presetId: string) => {
    const el = document.getElementById(`card-${presetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 비디오 일시정지 토글
  const togglePlay = (presetId: string) => {
    const player = playerRefs.current[presetId];
    if (!player) return;

    const state = player.getPlayerState();
    if (state === (window as any).YT.PlayerState.PLAYING) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      player.unMute();
      player.playVideo();
      setIsPlaying(true);
    }
  };

  // 가상 레코더 및 Whisper STT 시뮬레이터
  const startRecording = (presetId: string) => {
    setSpeakStates(prev => ({ ...prev, [presetId]: 'recording' }));
    
    setTimeout(() => {
      setSpeakStates(prev => ({ ...prev, [presetId]: 'analyzing' }));
      
      setTimeout(() => {
        const isCorrect = Math.random() > 0.25; 
        const preset = PRESETS.find(p => p.id === presetId);
        
        let userUtterance = "";
        let finalScore = 0;

        if (isCorrect && preset) {
          userUtterance = preset.targetEn;
          finalScore = Math.floor(Math.random() * 11) + 89; 
        } else if (preset) {
          userUtterance = preset.targetEn.replace("football", "soccer").replace("character", "spirit").replace("fights", "fight");
          finalScore = Math.floor(Math.random() * 20) + 55; 
        }

        setTranscriptions(prev => ({ ...prev, [presetId]: userUtterance }));
        setScores(prev => ({ ...prev, [presetId]: finalScore }));
        setSpeakStates(prev => ({ ...prev, [presetId]: 'result' }));

        if (finalScore >= 80) {
          setSuccessCounts(prev => ({ ...prev, [presetId]: (prev[presetId] || 0) + 1 }));
        }
      }, 1500);
    }, 2500);
  };

  // 스픽 모드 탭 전용 가상 레코더 & 해금 핸들러 (스픽 레벨 1 완료 시 쇼츠 레벨 2 해금 연동)
  const startSpeakTabRecording = () => {
    setSpeakTabState('recording');
    setTimeout(() => {
      setSpeakTabState('analyzing');
      setTimeout(() => {
        const isCorrect = Math.random() > 0.15; // 85% 확률 합격
        let userUtterance = "Look around";
        let finalScore = Math.floor(Math.random() * 11) + 89; // 89 ~ 99점
        
        if (!isCorrect) {
          userUtterance = "Look away";
          finalScore = Math.floor(Math.random() * 20) + 55; // 55 ~ 75점
        }

        setSpeakTabTranscription(userUtterance);
        setSpeakTabScore(finalScore);
        setSpeakTabState('result');

        if (finalScore >= 80) {
          setUnlockedLevels(prev => {
            if (!prev.includes(2)) {
              setIsUnlockToastVisible(true);
              return [...prev, 2];
            }
            return prev;
          });
        }
      }, 1500);
    }, 2500);
  };

  const handleSpeakTabRetry = () => {
    setSpeakTabState('idle');
    setSpeakTabScore(0);
    setSpeakTabTranscription('');
  };

  // 다시 도전
  const handleRetry = (presetId: string) => {
    setSpeakStates(prev => ({ ...prev, [presetId]: 'idle' }));
    setScores(prev => ({ ...prev, [presetId]: 0 }));
    setTranscriptions(prev => ({ ...prev, [presetId]: '' }));
    setPhases(prev => ({ ...prev, [presetId]: 1 }));
    setPlaybackRates(prev => ({ ...prev, [presetId]: 1.0 }));

    const player = playerRefs.current[presetId];
    const preset = PRESETS.find(p => p.id === presetId);
    if (player && preset) {
      player.seekTo(preset.startSeconds, true);
      player.playVideo();
    }
  };

  // 5단계 스픽 시퀀스 전동 제어 핸들러
  const triggerSpeakSequence = (presetId: string, currentPhase: number) => {
    const phaseKey = `${presetId}_${currentPhase}`;
    
    // STEP 1: 정지 + blur 오버레이 페이드인 (0.2초 대기)
    setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 1 }));
    
    setTimeout(() => {
      // STEP 2: 3초 카운트다운 시작
      setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 2 }));
      setCountdownNum(3);
      
      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownNum(count);
        } else {
          clearInterval(countdownInterval);
          
          // STEP 3: 녹음 활성화 (5초)
          setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 3 }));
          setRecordProgress(0);
          
          let recTime = 0;
          const recordInterval = setInterval(() => {
            recTime += 1;
            setRecordProgress(recTime);
            if (recTime >= 5) {
              clearInterval(recordInterval);
              finishRecordingAndEvaluate(presetId, phaseKey);
            }
          }, 1000);
          
          activeRecordIntervalRef.current = recordInterval;
        }
      }, 1000);
      
      activeCountdownIntervalRef.current = countdownInterval;
    }, 200);
  };

  const finishRecordingAndEvaluate = (presetId: string, phaseKey: string) => {
    if (activeRecordIntervalRef.current) {
      clearInterval(activeRecordIntervalRef.current);
      activeRecordIntervalRef.current = null;
    }
    
    // STEP 4: 판정 단계
    setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 4 }));
    
    setTimeout(() => {
      // 판정 완료 시뮬레이션
      const isCorrect = Math.random() > 0.15; // 85% 합격
      const score = isCorrect ? Math.floor(Math.random() * 11) + 89 : Math.floor(Math.random() * 20) + 55;
      
      const passed = score >= 80;
      setSeqResult(prev => ({ ...prev, [presetId]: passed ? 'pass' : 'fail' }));
      
      if (passed) {
        setSuccessCounts(prev => ({ ...prev, [presetId]: (prev[presetId] || 0) + 1 }));
        setScores(prev => ({ ...prev, [presetId]: Math.max(scores[presetId] || 0, score) }));
      }
      
      // 판정 아이콘 ✓ / ✗ 1.5초 대기
      setTimeout(() => {
        // STEP 5: 영상 재개
        setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 5 }));
        
        setTimeout(() => {
          // 시퀀스 상태 및 캐시 클리어
          setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 0 }));
          setSeqResult(prev => ({ ...prev, [presetId]: null }));
          setSeqDoneThisPhase(prev => ({ ...prev, [phaseKey]: true })); // 이번 phase 완료 마크
          
          // 비디오 다시 켜기
          const player = playerRefs.current[presetId];
          if (player && player.playVideo) {
            player.playVideo();
            setIsPlaying(true);
            startMonitoring(presetId); // 모니터링 인터벌 재개
          }
        }, 200); // fade-out 0.2초 대기
      }, 1500); // 아이콘 1.5초 노출
    }, 1500); // 음성 분석 1.5초 진행
  };

  const handleSkipSequence = (presetId: string, phaseKey: string) => {
    if (activeCountdownIntervalRef.current) {
      clearInterval(activeCountdownIntervalRef.current);
      activeCountdownIntervalRef.current = null;
    }
    if (activeRecordIntervalRef.current) {
      clearInterval(activeRecordIntervalRef.current);
      activeRecordIntervalRef.current = null;
    }
    
    // 즉시 STEP 5로 이동
    setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 5 }));
    
    setTimeout(() => {
      setSpeakSeqSteps(prev => ({ ...prev, [presetId]: 0 }));
      setSeqResult(prev => ({ ...prev, [presetId]: null }));
      setSeqDoneThisPhase(prev => ({ ...prev, [phaseKey]: true }));
      
      const player = playerRefs.current[presetId];
      if (player && player.playVideo) {
        player.playVideo();
        setIsPlaying(true);
        startMonitoring(presetId);
      }
    }, 200);
  };

  // 다음 영상 스크롤 다운 (해금된 상황 리스트 기준)
  const handleNextScroll = (presetId: string) => {
    const currentIndex = activePresets.findIndex(p => p.id === presetId);
    const nextPreset = activePresets[(currentIndex + 1) % activePresets.length];
    scrollToPreset(nextPreset.id);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>TAL Shorts Player</h1>
        <p>위아래로 부드럽게 스크롤하며 경기/인터뷰 영상 구간 훈련</p>
      </header>

      {/* 모바일 스마트폰 목업 프레임 */}
      <div className={styles.phoneFrame}>
        <div className={styles.phoneNotch} />
        
        <div className={styles.phoneScreen} onClick={handleGlobalInteraction}>
          
          {(activeTab === 'shorts' || activeTab === 'speak') && (
            <>
              {/* 상단 고정 목록형 상황 선택기 */}
              <div className={styles.presetBar}>
                <div className={styles.presetHeaderRow}>
                  <div className={styles.presetTitle}>
                    {activeTab === 'shorts' ? '쇼츠 감상 목록' : '실전 스피킹 훈련 목록'} ({unlockedLevels.includes(2) ? 'LV.1 & LV.2 오픈' : 'LV.1 해금됨'})
                  </div>
                  <button 
                    className={styles.listToggleBtn}
                    onClick={() => setIsListOpen(!isListOpen)}
                  >
                    {isListOpen ? '목록 닫기 ▲' : '상황 선택 ☰'}
                  </button>
                </div>
                
                {isListOpen && (
                  <div className={styles.verticalPresetList}>
                    {PRESETS.map((preset) => {
                      const isLocked = !unlockedLevels.includes(preset.level);
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            scrollToPreset(preset.id);
                            setIsListOpen(false);
                          }}
                          className={`${styles.verticalPresetItem} ${activePresetId === preset.id ? styles.verticalPresetItemActive : ''}`}
                          style={isLocked ? { opacity: 0.6 } : {}}
                        >
                          <div className={styles.presetItemLeft}>
                            <span className={styles.levelBadge} style={isLocked ? { background: 'var(--slate-2)' } : {}}>LV.{preset.level}</span>
                            <span className={styles.situationNameText}>{preset.situationName}</span>
                          </div>
                          <span className={styles.playIndicator}>
                            {isLocked ? '🔒 잠김' : activePresetId === preset.id ? 'NOW PLAYING ⚡' : '이동하기 →'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 수직 스냅 스크롤링 쇼츠 피드 컨테이너 */}
              <div 
                ref={containerRef} 
                className={styles.shortsContainer}
              >
                {PRESETS.map((preset) => {
                  const isLocked = !unlockedLevels.includes(preset.level);
                  const currentPhase = phases[preset.id] || 1;
                  const rate = playbackRates[preset.id] || 1.0;
                  const time = currentTimes[preset.id] || 0;
                  
                  // 재생 진행률 계산
                  const duration = preset.endSeconds - preset.startSeconds;
                  const elapsed = Math.max(0, time - preset.startSeconds);
                  const progressPercent = Math.min(100, (elapsed / duration) * 100);

                  return (
                    <div 
                      key={preset.id} 
                      id={`card-${preset.id}`}
                      data-preset-id={preset.id}
                      className={styles.shortsCard}
                    >
                      {/* 개별 유튜브 비디오 영역 */}
                      <div className={styles.videoArea}>
                        <div className={styles.youtubeWrapper}>
                          <div id={`youtube-player-${preset.id}`} className={styles.youtubeIframe}></div>
                        </div>

                        {/* 잠금 마스킹 오버레이 */}
                        {isLocked && (
                          <div className={styles.lockOverlay}>
                            <div className={styles.lockContent}>
                              <span className={styles.lockIcon}>🔒</span>
                              <h3 className={styles.lockTitle}>잠긴 상황 훈련 (LV.{preset.level})</h3>
                              <p className={styles.lockSubtitle}>
                                스픽 모드에서 80점 이상의 실전 훈련에<br />
                                성공하여 잠금을 해제해 주세요!
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 5단계 스피킹 시퀀스 오버레이 (오직 스픽 모드 탭에서만 활성화) */}
                        {activeTab === 'speak' && speakSeqSteps[preset.id] >= 1 && speakSeqSteps[preset.id] <= 4 && (
                          <div className={styles.speakSeqOverlay}>
                            
                            {/* STEP 2 - 카운트다운 */}
                            {speakSeqSteps[preset.id] === 2 && (
                              <div className={styles.speakSeqCountdown}>
                                <div className={styles.countdownCircle}>
                                  <span className={styles.countdownNumber}>{countdownNum}</span>
                                </div>
                                <div className={styles.countdownText}>"선수 대신 네가 말해봐!"</div>
                              </div>
                            )}

                            {/* STEP 3 - 녹음 활성화 (5초) */}
                            {speakSeqSteps[preset.id] === 3 && (
                              <div className={styles.micProgressContainer}>
                                <div className={styles.micRingWrapper}>
                                  <svg className={styles.progressSvg} viewBox="0 0 36 36">
                                    <path
                                      className={styles.progressRingCircleBg}
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                      className={styles.progressRingCircle}
                                      strokeDasharray={`${(recordProgress / 5) * 100}, 100`}
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                  </svg>
                                  <button 
                                    onClick={() => finishRecordingAndEvaluate(preset.id, `${preset.id}_${phases[preset.id] || 1}`)}
                                    className={styles.pulseMicBtn}
                                  >
                                    🎙️
                                  </button>
                                </div>
                                <div className={styles.countdownText}>지금 말하세요! (5초)</div>
                                <span className={styles.recordLimitText}>버튼을 다시 누르면 조기 완료</span>
                                <button 
                                  className={styles.skipBtn}
                                  onClick={() => handleSkipSequence(preset.id, `${preset.id}_${phases[preset.id] || 1}`)}
                                >
                                  SKIP ➔
                                </button>
                              </div>
                            )}

                            {/* STEP 4 - 판정 */}
                            {speakSeqSteps[preset.id] === 4 && (
                              <div style={{ textAlign: 'center', color: '#fff' }}>
                                {seqResult[preset.id] === null ? (
                                  <div className={styles.speakSeqCountdown}>
                                    <div className={styles.countdownCircle} style={{ borderColor: 'var(--terra-sky-2)' }}>
                                      <span className={styles.countdownNumber} style={{ fontSize: '24px' }}>🔄</span>
                                    </div>
                                    <div className={styles.countdownText}>AI 발음 분석 중...</div>
                                  </div>
                                ) : seqResult[preset.id] === 'pass' ? (
                                  <div>
                                    <span className={styles.seqResultIcon} style={{ color: '#00ff66' }}>✓</span>
                                    <div className={styles.seqResultText} style={{ color: '#00ff66' }}>EXCELLENT! 합격</div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className={styles.seqResultIcon} style={{ color: '#ef4444' }}>✗</span>
                                    <div className={styles.seqResultText} style={{ color: '#ef4444' }}>TRY AGAIN! 불합격</div>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        )}

                        {/* 영상 위 비주얼 오버레이 UI (재생 중이 아닐 때 반투명 블러 커버로 유튜브 UI 완벽 은폐) */}
                        <div className={`${styles.overlay} ${(activePresetId === preset.id && !isPlaying) ? styles.overlayPaused : ''}`}>
                          
                          {/* 상단 지표 영역 */}
                          <div className={styles.topSection}>
                            <div className={styles.badge}>
                              LV.{preset.level} | {preset.situationName}
                            </div>
                            
                            <div className={styles.phaseBadge}>
                              {currentPhase === 1 ? '1회차: 1.0x' : currentPhase === 2 ? '2회차: 0.75x' : '3회차: 0.5x'}
                            </div>

                            {/* Advanced 모드 토글 */}
                            <div 
                              onClick={() => setIsAdvanced(!isAdvanced)} 
                              className={`${styles.advToggle} ${isAdvanced ? styles.advActive : ''}`}
                            >
                              <span className={styles.advLabel}>
                                Advanced {isAdvanced ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </div>

                          {/* 중앙 일시정지/재생 제어 버튼 */}
                          <div className={styles.centerSection}>
                            {activePresetId === preset.id && (
                              <button onClick={() => togglePlay(preset.id)} className={styles.playPauseBtn}>
                                {isPlaying ? '⏸' : '▶'}
                              </button>
                            )}
                          </div>

                          {/* 하단 자막, 타임라인 및 마이크 제어 영역 */}
                          <div className={styles.bottomSection}>
                            
                            {/* 자막 가이드 (Advanced 여부에 따라 분기) */}
                            {!isAdvanced ? (
                              <div className={`${styles.captionCard} ${(activeTab === 'speak' && speakSeqSteps[preset.id] >= 1 && speakSeqSteps[preset.id] <= 4) ? styles.captionHidden : ''}`}>
                                <div className={styles.captionEn}>
                                  {preset.targetEn}
                                </div>
                                
                                <div className={styles.captionMeta}>
                                  <span>{preset.title.split(' ')[0]}</span>
                                  <span>속도: {rate.toFixed(2)}x</span>
                                </div>

                                {/* 진행률 인디케이터 */}
                                <div className={styles.timelineContainer}>
                                  <div className={styles.timelineBar}>
                                    <div 
                                      className={styles.timelineProgress} 
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={`${styles.captionCard} ${(activeTab === 'speak' && speakSeqSteps[preset.id] >= 1 && speakSeqSteps[preset.id] <= 4) ? styles.captionHidden : ''}`}>
                                <div className={styles.captionEn} style={{ color: 'var(--danger)', fontSize: '13.5px', fontWeight: 800 }}>
                                  🚫 Advanced 모드: 자막 없이 상황에 맞춰 발화하세요!
                                </div>
                              </div>
                            )}

                            {/* 동작 실행 버튼 마운트 (쇼츠 탭에서는 감상 모드 메세지, 스픽 탭에서는 챌린지 모드 표시) */}
                            <div className={styles.actionArea}>
                              {activeTab === 'shorts' ? (
                                <div style={{ fontSize: '11px', color: 'var(--slate-2)', textAlign: 'center', width: '100%', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                                  📺 쇼츠 감상 중 (감속 관찰 쉐도잉)
                                </div>
                              ) : (
                                <button 
                                  onClick={() => togglePlay(preset.id)} 
                                  className={styles.speakButton}
                                  style={{ 
                                    background: activePresetId === preset.id && isPlaying ? 'var(--canvas)' : 'var(--terra-blue)', 
                                    color: activePresetId === preset.id && isPlaying ? 'var(--slate)' : 'var(--canvas)',
                                    border: activePresetId === preset.id && isPlaying ? '1px solid var(--hairline-strong)' : 'none'
                                  }}
                                >
                                  {activePresetId === preset.id && isPlaying ? '⏸ 훈련 일시정지' : '▶ 실전 스피킹 훈련 시작'}
                                </button>
                              )}
                            </div>

                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* One Day 모드 데모 영역 */}
          {activeTab === 'oneday' && (
            <div className={styles.modePlaceholder}>
              <div className={styles.placeholderIcon}>📅</div>
              <h2>One Day 모드</h2>
              <p>매일 새롭게 주어지는 단 한 문장!<br/>하루 한 표현씩 핵심 축구 표현을 완전히 마스터합니다.</p>
              <div className={styles.placeholderBadge}>준비 중인 데모 영역</div>
            </div>
          )}

          {/* Collection 모드 실전 구단 연동 탭 영역 */}
          {activeTab === 'collection' && (
            <div className={`${styles.collectionTab} ${selectedClub === 'tottenham' ? styles.tottenhamTheme : selectedClub === 'mancity' ? styles.mancityTheme : styles.realmadridTheme}`}>
              
              {/* 상단 선호 구단 테마 선택기 */}
              <div className={styles.clubSelectorContainer}>
                <div className={styles.clubSelectorLabel}>선호 구단 테마 커스텀</div>
                <div className={styles.clubSelectorRow}>
                  <button 
                    onClick={() => setSelectedClub('tottenham')}
                    className={`${styles.clubBtn} ${selectedClub === 'tottenham' ? styles.clubBtnActiveTottenham : ''}`}
                  >
                    <span>⚪</span> 토트넘
                  </button>
                  <button 
                    onClick={() => setSelectedClub('mancity')}
                    className={`${styles.clubBtn} ${selectedClub === 'mancity' ? styles.clubBtnActiveMancity : ''}`}
                  >
                    <span>🔵</span> 맨시티
                  </button>
                  <button 
                    onClick={() => setSelectedClub('realmadrid')}
                    className={`${styles.clubBtn} ${selectedClub === 'realmadrid' ? styles.clubBtnActiveRealmadrid : ''}`}
                  >
                    <span>🟡</span> 레알마드리드
                  </button>
                </div>
              </div>

              {/* 구단 엠블럼/배지 진열대 */}
              <div className={styles.cabinetSection}>
                <div className={styles.cabinetTitle}>
                  🏆 구단 배지 수집함 (100% 마스터 시 획득)
                </div>
                <div className={styles.badgeGrid}>
                  
                  {/* 토트넘 엠블럼 (Look around 성공 시 해금) */}
                  <div className={`${styles.badgeItem} ${successCounts['user-clip-1'] > 0 ? styles.badgeItemActive : ''}`}>
                    <span className={styles.badgeEmblem}>🐔</span>
                    <span className={styles.badgeName}>토트넘 홋스퍼</span>
                    <span className={styles.badgeStatus}>
                      {successCounts['user-clip-1'] > 0 ? '🔓 획득 완료' : '🔒 미션 수행'}
                    </span>
                  </div>

                  {/* 맨시티 엠블럼 (Man on 성공 시 해금) */}
                  <div className={`${styles.badgeItem} ${successCounts['user-clip-2'] > 0 ? styles.badgeItemActive : ''}`}>
                    <span className={styles.badgeEmblem}>🦅</span>
                    <span className={styles.badgeName}>맨체스터 시티</span>
                    <span className={styles.badgeStatus}>
                      {successCounts['user-clip-2'] > 0 ? '🔓 획득 완료' : '🔒 미션 수행'}
                    </span>
                  </div>

                  {/* 레알마드리드 엠블럼 (잠김 고정) */}
                  <div className={styles.badgeItem}>
                    <span className={styles.badgeEmblem}>👑</span>
                    <span className={styles.badgeName}>레알 마드리드</span>
                    <span className={styles.badgeStatus}>🔒 미오픈</span>
                  </div>

                </div>
              </div>

              {/* 프로 선수 인터뷰 마스터 카드 진열대 */}
              <div className={styles.cardSection}>
                <div className={styles.cabinetTitle}>
                  🎙️ 프로 선수 마스터 카드 (FUT 스타일)
                </div>
                <div className={styles.cardGrid}>
                  
                  {/* 손흥민 카드 (Look around 성공 시 락 해제) */}
                  <div className={`${styles.playerCard} ${successCounts['user-clip-1'] > 0 ? `${styles.playerCardActive} ${styles.playerCardSonnyActive}` : ''}`}>
                    {successCounts['user-clip-1'] === 0 && (
                      <div className={styles.cardLockMask}>
                        <span className={styles.cardLockIcon}>🔒</span>
                        <span className={styles.cardLockText}>1번 훈련 성공 시 해금</span>
                      </div>
                    )}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardOvr}>{scores['user-clip-1'] || 91}</div>
                      <div className={styles.cardPos}>LW</div>
                    </div>
                    <div className={styles.cardImagePlaceholder}>🇰🇷</div>
                    <div className={styles.cardFooter}>
                      <div className={styles.cardPlayerName}>H. M. SON</div>
                      <div className={styles.cardClubText}>TOTTENHAM HOTSPUR</div>
                    </div>
                  </div>

                  {/* 엘링 홀란드 카드 (Man on 성공 시 락 해제) */}
                  <div className={`${styles.playerCard} ${successCounts['user-clip-2'] > 0 ? `${styles.playerCardActive} ${styles.playerCardHaalandActive}` : ''}`}>
                    {successCounts['user-clip-2'] === 0 && (
                      <div className={styles.cardLockMask}>
                        <span className={styles.cardLockIcon}>🔒</span>
                        <span className={styles.cardLockText}>2번 훈련 성공 시 해금</span>
                      </div>
                    )}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardOvr}>{scores['user-clip-2'] || 93}</div>
                      <div className={styles.cardPos}>ST</div>
                    </div>
                    <div className={styles.cardImagePlaceholder}>🇳🇴</div>
                    <div className={styles.cardFooter}>
                      <div className={styles.cardPlayerName}>E. HAALAND</div>
                      <div className={styles.cardClubText}>MANCHESTER CITY</div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* 하단 고정 탭 바 */}
          <div className={styles.bottomTabBar}>
            <button 
              className={`${styles.tabItem} ${activeTab === 'shorts' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('shorts')}
            >
              <span className={styles.tabIcon}>🎬</span>
              <span className={styles.tabLabel}>쇼츠 모드</span>
            </button>
            <button 
              className={`${styles.tabItem} ${activeTab === 'speak' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('speak')}
            >
              <span className={styles.tabIcon}>🎙️</span>
              <span className={styles.tabLabel}>스픽 모드</span>
            </button>
            <button 
              className={`${styles.tabItem} ${activeTab === 'oneday' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('oneday')}
            >
              <span className={styles.tabIcon}>📅</span>
              <span className={styles.tabLabel}>One Day</span>
            </button>
            <button 
              className={`${styles.tabItem} ${activeTab === 'collection' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('collection')}
            >
              <span className={styles.tabIcon}>📦</span>
              <span className={styles.tabLabel}>Collection</span>
            </button>
          </div>

          {/* 레벨 해금 안내 토스트 알림 */}
          {isUnlockToastVisible && (
            <div className={styles.unlockToast}>
              <span className={styles.toastIcon}>🔓</span>
              <div className={styles.toastText}>
                <strong>레벨 2 실전 상황 해금!</strong>
                <span>새로운 전술 지시와 압박 훈련이 열렸습니다.</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
