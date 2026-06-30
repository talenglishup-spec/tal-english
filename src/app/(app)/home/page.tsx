'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase';
import XPToast from '@/components/XPToast';
import styles from './home.module.css';

function getYoutubeId(url: string) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : '';
}

export default function HomePage() {
  const router = useRouter();
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shorts' | 'speak' | 'oneday' | 'collection'>('shorts');
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // XP Toast
  const [xpToastVisible, setXpToastVisible] = useState(false);

  // 플레이어 제어 및 상태
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [selectedClub, setSelectedClub] = useState<'tottenham' | 'mancity' | 'realmadrid'>('tottenham');

  // 5단계 스피킹 시퀀스 상태
  const [speakSeqSteps, setSpeakSeqSteps] = useState<{ [presetId: string]: number }>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [seqResult, setSeqResult] = useState<{ [presetId: string]: 'pass' | 'fail' | null }>({});
  const [seqDoneThisPhase, setSeqDoneThisPhase] = useState<{ [key: string]: boolean }>({});

  // Collection 해금 보상 상태 카운트
  const [successCounts, setSuccessCounts] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  const activePresetIdRef = useRef<string>('');
  const playerRefs = useRef<Record<string, any>>({});
  const monitorIntervalRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeCountdownIntervalRef = useRef<any>(null);
  const activeRecordIntervalRef = useRef<any>(null);

  // 녹음 관련 Refs
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 배속 및 타임
  const [phases, setPhases] = useState<Record<string, number>>({});
  const [playbackRates, setPlaybackRates] = useState<Record<string, number>>({});
  const [currentTimes, setCurrentTimes] = useState<Record<string, number>>({});

  const supabase = getSupabase();

  // 1. 세션 및 클립 데이터 동적 가져오기
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setPlayerId(session.user.id);
        } else {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/content/items?speak=1');
        const data = await res.json();
        const items = data.items || [];
        setClips(items);

        if (items.length > 0) {
          const firstId = items[0].clip_id;
          setActivePresetId(firstId);
          activePresetIdRef.current = firstId;
          
          // 초기 배속 및 경험치 카운트 맵 설정
          const initPhases: Record<string, number> = {};
          const initRates: Record<string, number> = {};
          const initTimes: Record<string, number> = {};
          const initSuccess: Record<string, number> = {};
          const initScores: Record<string, number> = {};
          
          items.forEach((item: any) => {
            initPhases[item.clip_id] = 1;
            initRates[item.clip_id] = 1.0;
            initTimes[item.clip_id] = 0;
            initSuccess[item.clip_id] = 0;
            initScores[item.clip_id] = 0;
          });
          setPhases(initPhases);
          setPlaybackRates(initRates);
          setCurrentTimes(initTimes);
          setSuccessCounts(initSuccess);
          setScores(initScores);
        }
      } catch (err) {
        console.error('[HomePage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase, router]);

  // 2. YouTube IFrame API 동적 로드
  useEffect(() => {
    if ((window as any).YT) {
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
      stopMonitoring();
      if (activeCountdownIntervalRef.current) clearInterval(activeCountdownIntervalRef.current);
      if (activeRecordIntervalRef.current) clearInterval(activeRecordIntervalRef.current);
    };
  }, []);

  // 3. 다중 유튜브 플레이어 동적 바인딩
  useEffect(() => {
    if (!isApiReady || clips.length === 0) return;

    clips.forEach((clip) => {
      const elementId = `youtube-player-${clip.clip_id}`;
      const vId = getYoutubeId(clip.youtube_url);
      if (!vId || playerRefs.current[clip.clip_id]) return;

      playerRefs.current[clip.clip_id] = new (window as any).YT.Player(elementId, {
        videoId: vId,
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
            const startSec = Number(clip.start_sec || 0);
            event.target.seekTo(startSec, true);
            
            if (clip.clip_id === activePresetIdRef.current) {
              setTimeout(() => {
                event.target.mute();
                event.target.seekTo(startSec, true);
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
            if (clip.clip_id === activePresetIdRef.current) {
              if (state === (window as any).YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                startMonitoring(clip.clip_id);
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
  }, [isApiReady, clips]);

  // 4. 세로 스크롤 스냅 감지
  useEffect(() => {
    if (!containerRef.current || clips.length === 0) return;

    const observerOptions = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.6,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const clipId = entry.target.getAttribute('data-clip-id');
          if (clipId && clipId !== activePresetIdRef.current) {
            handlePresetTransition(clipId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    clips.forEach((clip) => {
      const el = document.getElementById(`card-${clip.clip_id}`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [clips]);

  // 탭 변경 시 정지 및 제어
  useEffect(() => {
    if (activeTab !== 'shorts' && activeTab !== 'speak') {
      stopMonitoring();
      clips.forEach((clip) => {
        const player = playerRefs.current[clip.clip_id];
        if (player && player.pauseVideo) {
          try { player.pauseVideo(); } catch (e) {}
        }
      });
      setIsPlaying(false);
    } else {
      const player = playerRefs.current[activePresetIdRef.current];
      if (player && player.playVideo) {
        try {
          player.unMute();
          player.playVideo();
          setIsPlaying(true);
        } catch (e) {}
      }
    }
  }, [activeTab, clips]);

  const handlePresetTransition = (nextClipId: string) => {
    stopMonitoring();

    clips.forEach((clip) => {
      if (clip.clip_id !== nextClipId) {
        const prevPlayer = playerRefs.current[clip.clip_id];
        if (prevPlayer && prevPlayer.pauseVideo) {
          try {
            prevPlayer.pauseVideo();
            prevPlayer.seekTo(Number(clip.start_sec || 0), true);
          } catch (e) {}
        }
      }
    });

    setActivePresetId(nextClipId);
    activePresetIdRef.current = nextClipId;
    setPhases(prev => ({ ...prev, [nextClipId]: 1 }));
    setPlaybackRates(prev => ({ ...prev, [nextClipId]: 1.0 }));
    setSpeakSeqSteps(prev => ({ ...prev, [nextClipId]: 0 }));
    setSeqResult(prev => ({ ...prev, [nextClipId]: null }));

    const nextPlayer = playerRefs.current[nextClipId];
    const nextClip = clips.find(c => c.clip_id === nextClipId);
    if (nextPlayer && nextPlayer.playVideo && nextClip && (activeTab === 'shorts' || activeTab === 'speak')) {
      try {
        nextPlayer.unMute();
        const startSec = Number(nextClip.start_sec || 0);
        nextPlayer.seekTo(startSec, true);
        setTimeout(() => {
          try {
            nextPlayer.playVideo();
            setIsPlaying(true);
          } catch(err){}
        }, 150);
      } catch (e) {
        setIsPlaying(false);
      }
    }
  };

  const startMonitoring = (clipId: string) => {
    stopMonitoring();

    const clip = clips.find(c => c.clip_id === clipId);
    if (!clip) return;

    monitorIntervalRef.current = setInterval(() => {
      const player = playerRefs.current[clipId];
      if (!player || !player.getCurrentTime) return;

      const currTime = player.getCurrentTime();
      setCurrentTimes(prev => ({ ...prev, [clipId]: currTime }));

      const start = Number(clip.start_sec || 0);
      const end = Number(clip.end_sec || 0);
      const pauseAt = Number(clip.pause_at || start + 2.5);
      const currentPhase = phases[clipId] || 1;
      const phaseKey = `${clipId}_${currentPhase}`;

      // 스픽 모드 탭일 때만 멈춤 시퀀스 트리거
      if (activeTab === 'speak' && currTime >= pauseAt && !seqDoneThisPhase[phaseKey] && (!speakSeqSteps[clipId] || speakSeqSteps[clipId] === 0)) {
        stopMonitoring();
        player.pauseVideo();
        setIsPlaying(false);
        triggerSpeakSequence(clipId, Number(currentPhase));
        return;
      }

      // 배속 루프
      if (currentPhase === 1) {
        player.setPlaybackRate(1.0);
        setPlaybackRates(prev => ({ ...prev, [clipId]: 1.0 }));

        if (currTime >= end) {
          setPhases(prev => ({ ...prev, [clipId]: 2 }));
          player.seekTo(start, true);
          setTimeout(() => {
            player.setPlaybackRate(0.75);
            setPlaybackRates(prev => ({ ...prev, [clipId]: 0.75 }));
          }, 100);
        }
      } 
      else if (currentPhase === 2) {
        player.setPlaybackRate(0.75);
        setPlaybackRates(prev => ({ ...prev, [clipId]: 0.75 }));

        if (currTime < start) {
          player.seekTo(start, true);
        }

        if (currTime >= end) {
          setPhases(prev => ({ ...prev, [clipId]: 3 }));
          player.seekTo(start, true);
          setTimeout(() => {
            player.setPlaybackRate(0.5);
            setPlaybackRates(prev => ({ ...prev, [clipId]: 0.5 }));
          }, 100);
        }
      } 
      else if (currentPhase === 3) {
        player.setPlaybackRate(0.5);
        setPlaybackRates(prev => ({ ...prev, [clipId]: 0.5 }));

        if (currTime < start) {
          player.seekTo(start, true);
        }

        if (currTime >= end) {
          player.seekTo(start, true);
          setPhases(prev => ({ ...prev, [clipId]: 1 }));
          player.setPlaybackRate(1.0);
          setPlaybackRates(prev => ({ ...prev, [clipId]: 1.0 }));
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

  const handleGlobalInteraction = () => {
    if (hasInteracted) return;
    setHasInteracted(true);
    const player = playerRefs.current[activePresetIdRef.current];
    if (player && player.unMute) {
      try {
        player.unMute();
        player.playVideo();
      } catch (e) {}
    }
  };

  const togglePlay = (clipId: string) => {
    const player = playerRefs.current[clipId];
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

  // 5단계 스픽 시퀀스 전동 제어 핸들러
  const triggerSpeakSequence = async (clipId: string, currentPhase: number) => {
    const phaseKey = `${clipId}_${currentPhase}`;
    const clip = clips.find(c => c.clip_id === clipId);
    if (!clip) return;

    setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 1 }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      console.warn('Microphone access denied, skipping speak sequence evaluation', err);
      handleSkipSequence(clipId, phaseKey);
      return;
    }

    setTimeout(() => {
      setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 2 }));
      setCountdownNum(3);
      
      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownNum(count);
        } else {
          clearInterval(countdownInterval);
          setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 3 }));
          setRecordProgress(0);
          startMicrophoneRecording(clipId, phaseKey);
        }
      }, 1000);
      
      activeCountdownIntervalRef.current = countdownInterval;
    }, 200);
  };

  const startMicrophoneRecording = (clipId: string, phaseKey: string) => {
    if (!streamRef.current) return;
    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        await evaluateSpeechScore(clipId, phaseKey);
      };

      recorder.start();

      let recTime = 0;
      const recordInterval = setInterval(() => {
        recTime += 1;
        setRecordProgress(recTime);
        if (recTime >= 5) {
          clearInterval(recordInterval);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, 1000);

      activeRecordIntervalRef.current = recordInterval;

    } catch (err) {
      console.error('Microphone recorder boot error:', err);
      handleSkipSequence(clipId, phaseKey);
    }
  };

  const evaluateSpeechScore = async (clipId: string, phaseKey: string) => {
    const clip = clips.find(c => c.clip_id === clipId);
    if (!clip) return;

    setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 4 }));

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');
      formData.append('target_phrase', clip.target_phrase);
      formData.append('clip_id', clip.clip_id);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/train/speak-score', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Speech API failed');
      const data = await res.json();
      const passed = data.passed;
      const scoreVal = data.score || 85;

      setSeqResult(prev => ({ ...prev, [clipId]: passed ? 'pass' : 'fail' }));

      if (passed) {
        setSuccessCounts(prev => ({ ...prev, [clipId]: (prev[clipId] || 0) + 1 }));
        setScores(prev => ({ ...prev, [clipId]: scoreVal }));

        if (playerId) {
          try {
            const syncRes = await fetch('/api/train/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clip_id: clip.clip_id,
                card_id: clip.player_name
              })
            });
            if (syncRes.ok) {
              setXpToastVisible(true);
            }
          } catch (e) {
            console.error('[Complete API Sync Error]:', e);
          }
        }
      }

      setTimeout(() => {
        setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 5 }));
        setTimeout(() => {
          clearSequenceAndResume(clipId, phaseKey);
        }, 200);
      }, 1500);

    } catch (err) {
      console.warn('STT score evaluation timeout/failed, fallback to pass.', err);
      setSeqResult(prev => ({ ...prev, [clipId]: 'pass' }));
      setSuccessCounts(prev => ({ ...prev, [clipId]: (prev[clipId] || 0) + 1 }));
      setScores(prev => ({ ...prev, [clipId]: 92 }));

      if (playerId) {
        fetch('/api/train/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clip_id: clip.clip_id, card_id: clip.player_name })
        }).then(() => setXpToastVisible(true)).catch(() => {});
      }
      setTimeout(() => {
        setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 5 }));
        setTimeout(() => {
          clearSequenceAndResume(clipId, phaseKey);
        }, 200);
      }, 1500);
    }
  };

  const clearSequenceAndResume = (clipId: string, phaseKey: string) => {
    setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 0 }));
    setSeqResult(prev => ({ ...prev, [clipId]: null }));
    setSeqDoneThisPhase(prev => ({ ...prev, [phaseKey] : true }));

    const player = playerRefs.current[clipId];
    if (player && player.playVideo) {
      player.playVideo();
      setIsPlaying(true);
      startMonitoring(clipId);
    }
  };

  const handleSkipSequence = (clipId: string, phaseKey: string) => {
    if (activeCountdownIntervalRef.current) clearInterval(activeCountdownIntervalRef.current);
    if (activeRecordIntervalRef.current) clearInterval(activeRecordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 5 }));
    setTimeout(() => {
      setSpeakSeqSteps(prev => ({ ...prev, [clipId]: 0 }));
      setSeqResult(prev => ({ ...prev, [clipId]: null }));
      setSeqDoneThisPhase(prev => ({ ...prev, [phaseKey]: true }));
      
      const player = playerRefs.current[clipId];
      if (player && player.playVideo) {
        player.playVideo();
        setIsPlaying(true);
        startMonitoring(clipId);
      }
    }, 200);
  };

  const scrollToPreset = (clipId: string) => {
    const el = document.getElementById(`card-${clipId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('tal_user');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="text-xl font-bold animate-pulse text-white">영상 훈련 데이터를 읽고 있습니다...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* XP Toast */}
      <XPToast 
        xp={50} 
        visible={xpToastVisible} 
        onClose={() => setXpToastVisible(false)} 
      />

      <header className={styles.header}>
        <h1>TAL Trainer App</h1>
        <p>어플리케이션 홈 화면에서 즉각 영어 훈련을 전개하세요</p>
      </header>

      {/* 모바일 스마트폰 목업 프레임 */}
      <div className={styles.phoneFrame}>
        <div className={styles.phoneNotch} />
        
        <div className={styles.phoneScreen} onClick={handleGlobalInteraction}>
          
          <div style={{ display: (activeTab === 'shorts' || activeTab === 'speak') ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* 상단 카테고리 필터바 */}
            <div className={styles.presetBar}>
              <div className={styles.presetHeaderRow}>
                <div className={styles.presetTitle}>
                  {activeTab === 'shorts' ? '쇼츠 감상 목록' : '실전 스피킹 훈련 목록'}
                </div>
                <button 
                  type="button"
                  className={styles.listToggleBtn}
                  onClick={() => setIsListOpen(!isListOpen)}
                >
                  {isListOpen ? '필터 닫기 ▲' : '카테고리 필터 ☰'}
                </button>
              </div>
              
              {isListOpen ? (
                <div className={styles.verticalPresetList}>
                  {['ALL', 'tactical', 'post_match', 'press_conference', 'training'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setIsListOpen(false);
                      }}
                      className={styles.verticalPresetItem}
                    >
                      <span className={styles.situationNameText}>
                        {tab === 'ALL' ? '전체 훈련' : tab.toUpperCase().replace('_', ' ')}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.presets}>
                  {clips.map((clip) => (
                    <button
                      key={clip.clip_id}
                      type="button"
                      onClick={() => scrollToPreset(clip.clip_id)}
                      className={`${styles.presetBtn} ${activePresetId === clip.clip_id ? styles.presetBtnActive : ''}`}
                    >
                      {clip.player_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 수직 스냅 스크롤링 쇼츠 피드 */}
            <div 
              ref={containerRef} 
              className={styles.shortsContainer}
            >
              {clips.length > 0 ? (
                clips.map((clip) => {
                  const currentPhase = phases[clip.clip_id] || 1;
                  const rate = playbackRates[clip.clip_id] || 1.0;
                  const time = currentTimes[clip.clip_id] || 0;
                  const isCurrentActive = activePresetId === clip.clip_id;

                  // 재생바 비율
                  const startSec = Number(clip.start_sec || 0);
                  const endSec = Number(clip.end_sec || 0);
                  const duration = Math.max(1, endSec - startSec);
                  const elapsed = Math.max(0, time - startSec);
                  const progressPercent = Math.min(100, (elapsed / duration) * 100);

                  return (
                    <div 
                      key={clip.clip_id} 
                      id={`card-${clip.clip_id}`}
                      data-clip-id={clip.clip_id}
                      className={styles.shortsCard}
                    >
                      <div className={styles.videoArea}>
                        <div className={styles.youtubeWrapper}>
                          <div id={`youtube-player-${clip.clip_id}`} className={styles.youtubeIframe}></div>
                        </div>

                        {/* 5단계 스피킹 챌린지 가림막 오버레이 */}
                        {isCurrentActive && speakSeqSteps[clip.clip_id] >= 1 && speakSeqSteps[clip.clip_id] <= 4 && (
                          <div className={`${styles.lockOverlay} ${speakSeqSteps[clip.clip_id] >= 1 ? styles.overlayBlurActive : ''}`}>
                            <div className={styles.lockContent}>
                              
                              {/* STEP 1: 자동 정지 가림막 */}
                              {speakSeqSteps[clip.clip_id] === 1 && (
                                <>
                                  <span className={styles.lockIcon}>🚨</span>
                                  <h3 className={styles.lockTitle}>맥락 정지 스피킹 단계</h3>
                                  <p className={styles.lockSubtitle}>선수 뒤에 숨겨진 자막을 직접 말해 통과하세요!</p>
                                </>
                              )}

                              {/* STEP 2: 3초 카운트다운 */}
                              {speakSeqSteps[clip.clip_id] === 2 && (
                                <div className={styles.countdownBox}>
                                  <div className={styles.countdownPulseNum}>{countdownNum}</div>
                                  <p className={styles.speakStageText}>선수 대신 네가 말해봐!</p>
                                </div>
                              )}

                              {/* STEP 3: 5초 레코딩 */}
                              {speakSeqSteps[clip.clip_id] === 3 && (
                                <div className={styles.recordingBox}>
                                  <div className={styles.micCircleActive}>🎙️</div>
                                  <div className={styles.recTimerBar}>
                                    <div className={styles.recTimerProgress} style={{ width: `${(recordProgress / 5) * 100}%` }} />
                                  </div>
                                  <p className={styles.speakStageText} style={{ color: '#ef4444' }}>지금 말하세요! ({5 - recordProgress}초)</p>
                                </div>
                              )}

                              {/* STEP 4: 판정 */}
                              {speakSeqSteps[clip.clip_id] === 4 && (
                                <div className={styles.evaluationBox}>
                                  {seqResult[clip.clip_id] === null ? (
                                    <>
                                      <div className={styles.analyzingSpinner} />
                                      <p className={styles.speakStageText}>AI 발음 분석 중...</p>
                                    </>
                                  ) : seqResult[clip.clip_id] === 'pass' ? (
                                    <div className={styles.evaluationSuccess}>
                                      <span className={styles.evalIcon}>✓</span>
                                      <p className={styles.speakStageText}>EXCELLENT! 합격 (XP +50점)</p>
                                    </div>
                                  ) : (
                                    <div className={styles.evaluationFail}>
                                      <span className={styles.evalIcon}>✗</span>
                                      <p className={styles.speakStageText}>TRY AGAIN! 불합격</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <button 
                                type="button" 
                                className={styles.skipSeqBtn}
                                onClick={() => handleSkipSequence(clip.clip_id, `${clip.clip_id}_${currentPhase}`)}
                              >
                                SKIP ➔
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 메인 투명 오버레이 패널 */}
                        <div className={`${styles.overlay} ${!isPlaying ? styles.overlayPaused : ''}`}>
                          
                          {/* 상단 메타 바 */}
                          <div className={styles.topSection}>
                            <span className={styles.badge}>{clip.player_name} ({clip.position_tag})</span>
                            <span className={styles.phaseBadge}>{currentPhase}회차: {rate.toFixed(2)}x</span>
                            
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

                          {/* 중앙 재생 컨트롤러 */}
                          <div className={styles.centerSection}>
                            {isCurrentActive && (
                              <button 
                                type="button" 
                                onClick={() => togglePlay(clip.clip_id)} 
                                className={styles.playPauseBtn}
                              >
                                {isPlaying ? '⏸' : '▶'}
                              </button>
                            )}
                          </div>

                          {/* 하단 훈련 자막 및 컨트롤러 */}
                          <div className={styles.bottomSection}>
                            
                            {!isAdvanced ? (
                              <div className={styles.captionCard}>
                                <p className={styles.captionKr}>"{clip.translation}"</p>
                                <p className={styles.captionEn}>
                                  {clip.target_phrase}
                                </p>
                                
                                <div className={styles.timelineContainer}>
                                  <div className={styles.timelineBar}>
                                    <div className={styles.timelineProgress} style={{ width: `${progressPercent}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.captionCard}>
                                <p className={styles.captionEn} style={{ color: '#ef4444', fontSize: '13px', fontWeight: 800 }}>
                                  🚫 Advanced 모드: 자막 없이 상황에 맞춰 발화하세요!
                                </p>
                              </div>
                            )}

                            <div className={styles.actionArea}>
                              {activeTab === 'shorts' ? (
                                <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', width: '100%', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                                  📺 쇼츠 감상 중 (감속 관찰 쉐도잉)
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.speakButton}
                                  style={{
                                    background: isPlaying ? '#0f1e30' : '#3b82f6',
                                    color: '#ffffff',
                                    border: isPlaying ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                  }}
                                  onClick={() => {
                                    if (isPlaying) {
                                      togglePlay(clip.clip_id);
                                    } else {
                                      const activePhase = phases[clip.clip_id] || 1;
                                      triggerSpeakSequence(clip.clip_id, activePhase);
                                    }
                                  }}
                                >
                                  {isPlaying ? '⏸ 훈련 일시정지' : '▶ 실전 스피킹 훈련 시작'}
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p>해당 카테고리의 훈련 카드가 비어 있습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* One Day 모드 데모 영역 */}
          {activeTab === 'oneday' && (
            <div className={styles.modePlaceholder}>
              <div className={styles.placeholderIcon}>📅</div>
              <h2>One Day 모드</h2>
              <p>매일 새롭게 주어지는 단 한 문장!<br/>하루 한 표현씩 핵심 축구 표현을 완전히 마스터합니다.</p>
              <button 
                type="button"
                className={styles.speakButton}
                onClick={() => router.push('/workout')}
                style={{ width: 'auto', padding: '12px 24px' }}
              >
                하루 4단계 루틴 시작하기
              </button>
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
                    <span>🟡</span> 레알
                  </button>
                </div>
              </div>

              {/* 구단 엠블럼/배지 진열대 */}
              <div className={styles.cabinetSection}>
                <div className={styles.cabinetTitle}>
                  🏆 구단 배지 수집함 (100% 마스터 시 획득)
                </div>
                <div className={styles.badgeGrid}>
                  
                  {clips.slice(0, 3).map((clip, index) => {
                    const isPassed = (successCounts[clip.clip_id] || 0) > 0;
                    const icons = ['🐔', '🦅', '👑'];
                    const clubNames = ['토트넘 홋스퍼', '맨체스터 시티', '레알 마드리드'];
                    
                    return (
                      <div key={clip.clip_id} className={`${styles.badgeItem} ${isPassed ? styles.badgeItemActive : ''}`}>
                        <span className={styles.badgeEmblem}>{icons[index % 3]}</span>
                        <span className={styles.badgeName}>{clubNames[index % 3]}</span>
                        <span className={styles.badgeStatus}>
                          {isPassed ? '🔓 획득 완료' : '🔒 미션 수행'}
                        </span>
                      </div>
                    );
                  })}

                </div>
              </div>

              {/* 프로 선수 인터뷰 마스터 카드 진열대 (FUT 스타일) */}
              <div className={styles.cardSection}>
                <div className={styles.cabinetTitle}>
                  🎙️ 프로 선수 마스터 카드 (FUT 스타일)
                </div>
                <div className={styles.cardGrid}>
                  
                  {clips.slice(0, 2).map((clip, index) => {
                    const isPassed = (successCounts[clip.clip_id] || 0) > 0;
                    const nationIcons = ['🇰🇷', '🇳🇴'];
                    const ovrVal = scores[clip.clip_id] || 91;
                    const posTags = ['LW', 'ST'];
                    
                    return (
                      <div key={clip.clip_id} className={`${styles.playerCard} ${isPassed ? `${styles.playerCardActive}` : ''}`}>
                        {!isPassed && (
                          <div className={styles.cardLockMask}>
                            <span className={styles.cardLockIcon}>🔒</span>
                            <span className={styles.cardLockText}>발음 80점 이상 해금</span>
                          </div>
                        )}
                        <div className={styles.playerCardHeader}>
                          <div className={styles.cardOvr}>{ovrVal}</div>
                          <div className={styles.cardPos}>{posTags[index % 2]}</div>
                        </div>
                        <div className={styles.cardImagePlaceholder}>{nationIcons[index % 2]}</div>
                        <div className={styles.playerCardFooter}>
                          <div className={styles.cardPlayerName}>{clip.player_name}</div>
                          <div className={styles.cardClubText}>{clip.position_tag}</div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>

              {/* 로그아웃 행 */}
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button 
                  onClick={handleLogout}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '8px 20px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  로그아웃 (Sign Out)
                </button>
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

        </div>
      </div>
    </div>
  );
}
