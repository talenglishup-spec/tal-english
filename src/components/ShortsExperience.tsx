'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase';
import XPToast from '@/components/XPToast';
import ClipProgressBar from '@/components/ClipProgressBar';
import GuideDocent from '@/components/GuideDocent';
import { useShortsMonitor } from '@/hooks/useShortsMonitor';
import styles from '@/app/shorts/ShortsPage.module.css';

// 활성 클립 기준 앞뒤 몇 개까지 YouTube Player 인스턴스를 살려둘지.
// 피드의 모든 클립에 대해 플레이어를 한꺼번에 만들면 메모리/쿼터 부담이
// 커지므로, 활성 ± WINDOW 범위만 유지하고 나머지는 destroy한다.
const PLAYER_WINDOW = 1;

// 스픽 훈련 진행 단계 (clipId별)
//   armed     : pause_at에서 영상이 멈추고 "말하기 시작" 버튼 대기
//   recording : 마이크 녹음 중
//   review    : 녹음 완료 → 내 발음 듣기 / 모범 답안 듣기 / 넘어가기
type SpeakStage = 'armed' | 'recording' | 'review';
const REC_MAX_SEC = 12; // 녹음 안전 상한 (자동 종료)

// ⑥ 연속 학습: 오늘의 스픽 훈련 목표 시청 시간(초)
const DAILY_GOAL_SEC = 120;
// 오늘 날짜 키 (KST 기준 로컬 저장용)
function todayKey() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
}

function getYoutubeId(url: string) {
  if (!url) return '';
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

export default function ShortsPage() {
  const router = useRouter();
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'shorts' | 'collection' | 'my'>('home');

  // 클립별 스픽 모드 (1회성): 쇼츠 피드에서 🎙️ 버튼을 누른 영상만 true.
  // true인 동안 1회차·1배속 고정 + pause_at 자동 정지가 활성화되고,
  // 발화 종료(넘어가기)·다른 영상으로 스크롤 시 false(쇼츠 모드)로 복귀한다.
  const [speakMode, setSpeakMode] = useState<Record<string, boolean>>({});
  const speakModeRef = useRef<Record<string, boolean>>({});
  const setClipSpeakMode = (clipId: string, on: boolean) => {
    speakModeRef.current = { ...speakModeRef.current, [clipId]: on };
    setSpeakMode(prev => ({ ...prev, [clipId]: on }));
  };
  const [myStats, setMyStats] = useState<any>(null);
  const [myLoading, setMyLoading] = useState<boolean>(false);
  const [shareMsg, setShareMsg] = useState<string>('');
  // 스픽 성공한 clip_id 집합 (표현 레벨 계산용)
  const [passedClips, setPassedClips] = useState<Set<string>>(new Set());
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // XP Toast
  const [xpToastVisible, setXpToastVisible] = useState(false);

  // 플레이어 제어 및 상태
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  // 콜백/타이머 내부에서 최신 상호작용 여부를 읽기 위한 ref 미러.
  // 브라우저 자동재생 정책상 사용자 제스처 전에는 unMute()가 무시되므로,
  // 제스처가 발생하기 전에는 muted 자동재생만 하고 unMute를 호출하지 않는다.
  const hasInteractedRef = useRef(false);
  // 활성 클립의 "실제" 음소거 여부 — 폴링으로 동기화한다.
  // 기기(특히 iOS)에 따라 전환 시 프로그램적 unMute가 무시될 수 있어,
  // hasInteracted 플래그가 아닌 플레이어의 isMuted()가 진실이다.
  // 이 값이 true인 동안 "🔇 탭하여 소리 켜기" 칩을 영상마다 노출한다.
  const [isSoundMuted, setIsSoundMuted] = useState(true);
  const [isListOpen, setIsListOpen] = useState(false);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [selectedClub, setSelectedClub] = useState<'tottenham' | 'mancity' | 'realmadrid'>('tottenham');

  // 스픽 훈련 상태 (clipId별)
  const [speakStage, setSpeakStage] = useState<Record<string, SpeakStage>>({});
  const [recElapsed, setRecElapsed] = useState<number>(0);
  const [myAudioUrl, setMyAudioUrl] = useState<string | null>(null);
  const [seqResult, setSeqResult] = useState<{ [presetId: string]: 'pass' | 'fail' | null }>({});
  // 채점 단어별 피드백 (clipId별): target 단어 순서대로 [{w, ok}]
  const [wordFeedback, setWordFeedback] = useState<Record<string, { w: string; ok: boolean }[]>>({});
  // clipId별 "이번 클립 스픽 완료" 여부 — 완료 후엔 pause_at 자동정지를 재발동하지 않는다
  const [spokenDone, setSpokenDone] = useState<Record<string, boolean>>({});

  // 핸즈프리: 합격 후 자동으로 다음 클립으로 넘어감
  const [handsFree, setHandsFree] = useState<boolean>(false);
  const handsFreeRef = useRef(false);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  // ⑥ 연속 학습 카운트다운 (오늘 스픽 활성 시청 누적초 → 일일 목표)
  const [dailyStudied, setDailyStudied] = useState<number>(0);
  const [goalCelebrated, setGoalCelebrated] = useState<boolean>(false);
  const dailyStudiedRef = useRef(0);
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Collection 해금 보상 상태 카운트
  const [successCounts, setSuccessCounts] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  const activePresetIdRef = useRef<string>('');
  const playerRefs = useRef<Record<string, any>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 재생 감시 엔진 (배속 3단계 전이 · pause_at 자동 정지 · 버퍼링 가드)
  const monitor = useShortsMonitor();

  const activeRecordIntervalRef = useRef<any>(null);
  const modelWatchRef = useRef<any>(null);      // 모범 답안(영상 구간) 재생 감시 인터벌
  const myAudioElRef = useRef<HTMLAudioElement | null>(null); // 내 발음 재생 엘리먼트

  // 녹음 관련 Refs
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 배속 (현재 재생 위치 currentTime은 더 이상 부모 state로 두지 않는다 —
  // 진행바는 ClipProgressBar가 자체 rAF로 폴링하므로 매 프레임 리렌더 제거)
  const [phases, setPhases] = useState<Record<string, number>>({});
  const [playbackRates, setPlaybackRates] = useState<Record<string, number>>({});

  // 감시 루프 콜백은 항상 아래 ref들을 통해 최신값을 읽는다 (stale closure 방지).
  const phasesRef = useRef<Record<string, number>>({});
  const activeTabRef = useRef(activeTab);
  const speakStageRef = useRef<Record<string, SpeakStage>>({});
  const spokenDoneRef = useRef<Record<string, boolean>>({});
  const clipsRef = useRef<any[]>([]);

  useEffect(() => { phasesRef.current = phases; }, [phases]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { speakStageRef.current = speakStage; }, [speakStage]);
  useEffect(() => { spokenDoneRef.current = spokenDone; }, [spokenDone]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  // ⑥ 오늘 훈련 활성 시청 누적초 로드 + 1초 틱 (통합 쇼츠 탭 재생 중일 때 증가)
  useEffect(() => {
    const key = `tal_speak_secs_${todayKey()}`;
    const goalKey = `tal_speak_goal_${todayKey()}`;
    const saved = Number(localStorage.getItem(key) || '0');
    dailyStudiedRef.current = saved;
    setDailyStudied(saved);
    setGoalCelebrated(localStorage.getItem(goalKey) === '1');

    const id = setInterval(() => {
      if (activeTabRef.current === 'shorts' && isPlayingRef.current) {
        const v = dailyStudiedRef.current + 1;
        dailyStudiedRef.current = v;
        setDailyStudied(v);
        localStorage.setItem(key, String(v));
        if (v >= DAILY_GOAL_SEC && localStorage.getItem(goalKey) !== '1') {
          localStorage.setItem(goalKey, '1');
          setGoalCelebrated(true);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // 활성 클립 기준 윈도우 안에 들어오는 clip_id 집합 (플레이어 생성 대상)
  const mountedIds = useMemo(() => {
    const ids = new Set<string>();
    if (clips.length === 0) return ids;
    const idx = clips.findIndex(c => c.clip_id === activePresetId);
    const center = idx < 0 ? 0 : idx;
    for (let i = center - PLAYER_WINDOW; i <= center + PLAYER_WINDOW; i++) {
      if (clips[i]) ids.add(clips[i].clip_id);
    }
    return ids;
  }, [clips, activePresetId]);

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
          const initSuccess: Record<string, number> = {};
          const initScores: Record<string, number> = {};

          items.forEach((item: any) => {
            initPhases[item.clip_id] = 1;
            initRates[item.clip_id] = 1.0;
            initSuccess[item.clip_id] = 0;
            initScores[item.clip_id] = 0;
          });
          phasesRef.current = initPhases;
          setPhases(initPhases);
          setPlaybackRates(initRates);
          setSuccessCounts(initSuccess);
          setScores(initScores);
        }
      } catch (err) {
        console.error('[ShortsPage] Fetch error:', err);
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
      if (activeRecordIntervalRef.current) clearInterval(activeRecordIntervalRef.current);
      if (modelWatchRef.current) clearInterval(modelWatchRef.current);
    };
  }, []);

  // 3. 윈도우 기반 유튜브 플레이어 생성/파괴 (활성 ± PLAYER_WINDOW만 유지)
  //    React가 관리하는 host div(<div id="yt-host-...">)는 항상 렌더링되고,
  //    그 안에 imperative하게 자식 div를 만들어 YT.Player를 붙인다. React는
  //    host의 자식을 JSX로 관리하지 않으므로, 플레이어를 destroy할 때
  //    React 재조정과 YT의 DOM 조작이 충돌하지 않는다.
  useEffect(() => {
    if (!isApiReady) return;

    const YT = (window as any).YT;

    // (a) 윈도우 안에 있는데 아직 플레이어가 없는 클립 → 생성
    mountedIds.forEach((clipId) => {
      if (playerRefs.current[clipId]) return;
      const clip = clips.find(c => c.clip_id === clipId);
      if (!clip) return;
      const vId = getYoutubeId(clip.youtube_url);
      const host = document.getElementById(`yt-host-${clipId}`);
      if (!vId || !host) return;

      const mountDiv = document.createElement('div');
      mountDiv.style.width = '100%';
      mountDiv.style.height = '100%';
      host.appendChild(mountDiv);

      playerRefs.current[clipId] = new YT.Player(mountDiv, {
        videoId: vId,
        playerVars: {
          autoplay: 0,
          // controls:1 — 네이티브 컨트롤(재생/정지·진행바·볼륨·전체화면·YouTube
          // 로고)을 노출한다. Developer Policy III.I.4 / RMF는 이 컨트롤을 숨기는
          // 것(controls:0)을 금지하므로 반드시 1을 유지한다. 재생/정지는 네이티브
          // 플레이어에 맡기고, 오버레이는 이 컨트롤을 가리지 않는다(정책 준수).
          controls: 1,
          iv_load_policy: 3,
          rel: 0,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event: any) => {
            event.target.mute();
            const startSec = Number(clip.start_sec || 0);
            event.target.seekTo(startSec, true);

            if (clip.clip_id === activePresetIdRef.current) {
              // 경쟁(race) 제거: 여기서 다시 mute()를 호출하지 않는다.
              // muted 자동재생만 하고, 사용자 제스처가 있었을 때만 unMute.
              setTimeout(() => {
                try {
                  event.target.seekTo(startSec, true);
                  if (hasInteractedRef.current) event.target.unMute();
                  event.target.playVideo();
                  setIsPlaying(true);
                } catch (e) {}
              }, 300);
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            if (clip.clip_id === activePresetIdRef.current) {
              if (state === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                // 스픽 오버레이(모범 답안 재생 등)가 떠 있는 중엔 감시 루프를
                // 재가동하지 않는다 — 발화 종료(넘어가기) 시 명시적으로 재시작.
                if (!speakStageRef.current[clip.clip_id]) {
                  startMonitoring(clip.clip_id);
                }
              } else if (state === YT.PlayerState.PAUSED ||
                         state === YT.PlayerState.ENDED) {
                setIsPlaying(false);
              }
            }
          }
        }
      });
    });

    // (b) 윈도우 밖으로 나갔는데 아직 살아있는 플레이어 → 파괴
    Object.keys(playerRefs.current).forEach((clipId) => {
      if (mountedIds.has(clipId)) return;
      try { playerRefs.current[clipId].destroy(); } catch (e) {}
      delete playerRefs.current[clipId];
      const host = document.getElementById(`yt-host-${clipId}`);
      if (host) host.innerHTML = '';
    });
  }, [isApiReady, clips, mountedIds]);

  // 언마운트 시 감시 루프 및 전 플레이어 정리
  useEffect(() => {
    return () => {
      stopMonitoring();
      Object.keys(playerRefs.current).forEach((clipId) => {
        try { playerRefs.current[clipId].destroy(); } catch (e) {}
      });
      playerRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (activeTab !== 'shorts') {
      stopMonitoring();
      resetSpeakArtifacts(activePresetIdRef.current);
      clips.forEach((clip) => {
        const player = playerRefs.current[clip.clip_id];
        if (player && player.pauseVideo) {
          try { player.pauseVideo(); } catch (e) {}
        }
      });
      setIsPlaying(false);
    } else {
      // 스픽 오버레이가 떠 있는 중이면 자동 재생하지 않는다 (사용자 입력 대기)
      if (speakStageRef.current[activePresetIdRef.current]) return;
      const player = playerRefs.current[activePresetIdRef.current];
      if (player && player.playVideo) {
        try {
          // 제스처가 있었을 때만 소리를 켠다(정책 준수 + race 방지)
          if (hasInteractedRef.current) player.unMute();
          player.playVideo();
          setIsPlaying(true);
        } catch (e) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, clips]);

  const handlePresetTransition = (nextClipId: string) => {
    stopMonitoring();
    // 이전 클립의 진행 중이던 스픽 훈련(녹음/타이머 등)을 정리
    resetSpeakArtifacts(activePresetIdRef.current);

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

    // 이전 활성 클립은 스픽 모드 해제 (다른 영상으로 넘어가면 자동 쇼츠 복귀)
    const prevActiveId = activePresetIdRef.current;
    if (prevActiveId && speakModeRef.current[prevActiveId]) {
      setClipSpeakMode(prevActiveId, false);
    }

    setActivePresetId(nextClipId);
    activePresetIdRef.current = nextClipId;
    // ref도 즉시 동기화 — 새 활성 클립은 1회차부터 다시 시작, 기본 쇼츠 모드
    phasesRef.current = { ...phasesRef.current, [nextClipId]: 1 };
    spokenDoneRef.current = { ...spokenDoneRef.current, [nextClipId]: false };
    setClipSpeakMode(nextClipId, false);
    setPhases(prev => ({ ...prev, [nextClipId]: 1 }));
    setPlaybackRates(prev => ({ ...prev, [nextClipId]: 1.0 }));
    setSpokenDone(prev => ({ ...prev, [nextClipId]: false }));
    setSeqResult(prev => ({ ...prev, [nextClipId]: null }));

    const nextPlayer = playerRefs.current[nextClipId];
    const nextClip = clips.find(c => c.clip_id === nextClipId);
    if (nextPlayer && nextPlayer.playVideo && nextClip && activeTab === 'shorts') {
      try {
        const startSec = Number(nextClip.start_sec || 0);
        nextPlayer.seekTo(startSec, true);
        setTimeout(() => {
          try {
            // 스크롤 전환도 제스처 여부에 따라서만 unMute (첫 로드 자동스냅은 muted)
            if (hasInteractedRef.current) nextPlayer.unMute();
            nextPlayer.playVideo();
            setIsPlaying(true);
          } catch(err){}
        }, 150);
      } catch (e) {
        setIsPlaying(false);
      }
    }
  };

  // 재생 감시 시작 — 실제 루프 로직은 useShortsMonitor 훅이 소유한다.
  // 페이지는 "어떤 값을 읽고, 전이 시 무엇을 갱신할지"만 콜백으로 넘긴다.
  const startMonitoring = (clipId: string) => {
    const clip = clipsRef.current.find(c => c.clip_id === clipId);
    if (!clip) return;

    const start = Number(clip.start_sec || 0);
    const end = Number(clip.end_sec || 0);
    const pauseAt = Number(clip.pause_at || start + 2.5);

    monitor.start({
      getPlayer: () => playerRefs.current[clipId],
      start,
      end,
      pauseAt,
      getPhase: () => phasesRef.current[clipId] || 1,
      // 이 클립이 스픽 모드면 3회차 감속 없이 1회차(1.0x)만 반복.
      // 클립별 상태이므로 🎙️ 버튼 토글에 실시간 반응한다.
      advancePhases: () => !speakModeRef.current[clipId],
      shouldAutoPause: () => {
        // 이 클립이 스픽 모드 & 이번 발화 미완료 & 스픽 오버레이 idle일 때만
        return (
          !!speakModeRef.current[clipId] &&
          !spokenDoneRef.current[clipId] &&
          !speakStageRef.current[clipId]
        );
      },
      onAutoPause: () => {
        // pause_at 도달: 영상은 이미 멈춤. 마이크를 바로 켜지 않고
        // "말하기 시작" 버튼을 띄운 채 사용자 입력을 기다린다.
        setIsPlaying(false);
        armSpeak(clipId);
      },
      onPhaseChange: (nextPhase, nextRate) => {
        // ref를 즉시 갱신 — useEffect 동기화를 기다리지 않고 다음 프레임부터
        // 새 phase가 반영되도록 하여 2회차→3회차 전이 누락을 막는다.
        phasesRef.current = { ...phasesRef.current, [clipId]: nextPhase };
        setPhases(prev => ({ ...prev, [clipId]: nextPhase }));
        setPlaybackRates(prev => ({ ...prev, [clipId]: nextRate }));
      },
    });
  };

  const stopMonitoring = () => {
    monitor.stop();
  };

  // 소리 켜기 — 실제 제스처(칩/중앙 탭/🎙️ 버튼) 안에서만 호출한다.
  const enableSound = (clipId: string) => {
    setHasInteracted(true);
    hasInteractedRef.current = true;
    const player = playerRefs.current[clipId];
    if (player && player.unMute) {
      try {
        player.unMute();
        player.playVideo();
      } catch (e) {}
    }
    setIsSoundMuted(false); // 폴링이 다음 틱에 실제 상태로 재확인
  };

  // 활성 클립의 실제 음소거 상태 폴링 — 칩 노출 판단의 단일 진실.
  // 전환 시 unMute가 무시되는 기기에서는 매 영상 muted로 시작하므로
  // 칩이 영상마다 다시 나타나고, unMute가 유지되는 기기에서는 안 뜬다.
  useEffect(() => {
    if (activeTab !== 'shorts') return;
    const id = setInterval(() => {
      const p = playerRefs.current[activePresetIdRef.current];
      if (!p || typeof p.isMuted !== 'function') return;
      try { setIsSoundMuted(!!p.isMuted()); } catch (e) {}
    }, 700);
    return () => clearInterval(id);
  }, [activeTab, activePresetId]);

  // controls:1에서는 재생/정지·볼륨·전체화면을 모두 네이티브 컨트롤이 처리한다.
  // 소리는 네이티브 볼륨 버튼 또는 "🔇 탭하여 소리 켜기" 칩(enableSound)으로 켠다.
  // (isPlaying 상태는 onStateChange가 네이티브 재생/정지에 맞춰 자동 동기화)

  // ── 스픽 훈련 상태 헬퍼 ──────────────────────────────────────
  const setStage = (clipId: string, stage: SpeakStage) => {
    speakStageRef.current = { ...speakStageRef.current, [clipId]: stage };
    setSpeakStage(prev => ({ ...prev, [clipId]: stage }));
  };
  const clearStage = (clipId: string) => {
    const nextRef = { ...speakStageRef.current };
    delete nextRef[clipId];
    speakStageRef.current = nextRef;
    setSpeakStage(prev => {
      const n = { ...prev };
      delete n[clipId];
      return n;
    });
  };

  // 진행 중이던 녹음/타이머/모범답안 재생/오디오를 모두 정리
  const resetSpeakArtifacts = (clipId?: string) => {
    if (activeRecordIntervalRef.current) { clearInterval(activeRecordIntervalRef.current); activeRecordIntervalRef.current = null; }
    if (modelWatchRef.current) { clearInterval(modelWatchRef.current); modelWatchRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.onstop = null as any; mediaRecorderRef.current.stop(); } catch (e) {}
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (myAudioElRef.current) { try { myAudioElRef.current.pause(); } catch (e) {} myAudioElRef.current = null; }
    setMyAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (clipId) clearStage(clipId);
  };

  // 1) pause_at 자동 정지 → "말하기 시작" 버튼 대기 (armed)
  const armSpeak = (clipId: string) => {
    setSeqResult(prev => ({ ...prev, [clipId]: null }));
    setWordFeedback(prev => { const n = { ...prev }; delete n[clipId]; return n; });
    setMyAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setStage(clipId, 'armed');
  };

  // 리뷰 → "다시하기": 결과/녹음을 버리고 다시 말하기 대기 단계로
  const retrySpeak = (clipId: string) => {
    if (myAudioElRef.current) { try { myAudioElRef.current.pause(); } catch (e) {} myAudioElRef.current = null; }
    if (modelWatchRef.current) { clearInterval(modelWatchRef.current); modelWatchRef.current = null; }
    // 모범답안 재생 등으로 영상이 움직였을 수 있으니 pause_at 지점으로 되돌린다
    const clip = clipsRef.current.find(c => c.clip_id === clipId);
    const player = playerRefs.current[clipId];
    if (player && clip) {
      const start = Number(clip.start_sec || 0);
      const pauseAt = Number(clip.pause_at || start + 2.5);
      try { player.pauseVideo(); player.seekTo(pauseAt, true); } catch (e) {}
    }
    armSpeak(clipId);
  };

  // 2) "말하기 시작" 클릭 → 즉시 녹음 시작 (카운트다운 없음)
  const startSpeaking = async (clipId: string) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      console.warn('Microphone access denied', err);
      alert('마이크 접근이 거부되었습니다. 브라우저 마이크 권한을 허용해 주세요.');
      return;
    }

    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setMyAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
        setStage(clipId, 'review');
        scoreRecording(clipId, blob);
      };

      recorder.start();
      setRecElapsed(0);
      setStage(clipId, 'recording');

      let elapsed = 0;
      activeRecordIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setRecElapsed(elapsed);
        if (elapsed >= REC_MAX_SEC) {
          clearInterval(activeRecordIntervalRef.current);
          activeRecordIntervalRef.current = null;
          if (recorder.state !== 'inactive') recorder.stop();
        }
      }, 1000);
    } catch (err) {
      console.error('Recorder boot error:', err);
      alert('녹음을 시작할 수 없습니다.');
    }
  };

  // 3) "말하기 완료" 클릭 → 녹음 종료 (onstop이 채점/리뷰 전환 처리)
  const stopSpeaking = () => {
    if (activeRecordIntervalRef.current) { clearInterval(activeRecordIntervalRef.current); activeRecordIntervalRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // 4) 백그라운드 채점 (리뷰 화면은 이미 떠 있음)
  const scoreRecording = async (clipId: string, blob: Blob) => {
    const clip = clipsRef.current.find(c => c.clip_id === clipId);
    if (!clip) return;

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'speech.webm');
      formData.append('clip_id', clip.clip_id);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/train/speak-score', { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Speech API failed');
      const data = await res.json();
      const passed = data.passed;
      const scoreVal = data.score || 85;

      setSeqResult(prev => ({ ...prev, [clipId]: passed ? 'pass' : 'fail' }));
      // ① 단어별 색상 피드백 데이터 저장 (서버 wordDiff)
      if (Array.isArray(data.words)) {
        setWordFeedback(prev => ({ ...prev, [clipId]: data.words }));
      }

      if (passed) {
        setSuccessCounts(prev => ({ ...prev, [clipId]: (prev[clipId] || 0) + 1 }));
        setScores(prev => ({ ...prev, [clipId]: scoreVal }));
        if (playerId) {
          try {
            const syncRes = await fetch('/api/train/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clip_id: clip.clip_id, card_id: clip.player_name })
            });
            if (syncRes.ok) setXpToastVisible(true);
          } catch (e) {
            console.error('[Complete API Sync Error]:', e);
          }
        }

        // ⑦ 핸즈프리: 합격 시 잠시 후 자동으로 다음 클립으로 이동
        if (handsFreeRef.current) {
          setTimeout(() => {
            if (speakStageRef.current[clipId] === 'review') {
              finishSpeak(clipId);
              goNextClip(clipId);
            }
          }, 2500);
        }
      }
    } catch (err) {
      console.warn('STT score evaluation failed.', err);
      setSeqResult(prev => ({ ...prev, [clipId]: 'fail' }));
    }
  };

  // ⑦ 다음 클립으로 스크롤 이동 (스냅 → IntersectionObserver가 전환 처리)
  const goNextClip = (fromClipId: string) => {
    const list = clipsRef.current;
    const idx = list.findIndex(c => c.clip_id === fromClipId);
    const next = idx >= 0 ? list[idx + 1] : null;
    if (next) scrollToPreset(next.clip_id);
  };

  // 리뷰: 내 발음 듣기
  const playMyRecording = () => {
    if (!myAudioUrl) return;
    try {
      if (myAudioElRef.current) myAudioElRef.current.pause();
      const audio = new Audio(myAudioUrl);
      myAudioElRef.current = audio;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  // 리뷰: 모범 답안 듣기 — 영상의 해당 구간(start~pause_at)을 소리와 함께 재생
  const playModelAnswer = (clipId: string) => {
    const player = playerRefs.current[clipId];
    const clip = clipsRef.current.find(c => c.clip_id === clipId);
    if (!player || !clip) return;

    const start = Number(clip.start_sec || 0);
    const pauseAt = Number(clip.pause_at || start + 2.5);

    if (modelWatchRef.current) { clearInterval(modelWatchRef.current); modelWatchRef.current = null; }
    try {
      player.setPlaybackRate(1.0);
      player.unMute();
      player.seekTo(start, true);
      player.playVideo();
    } catch (e) {}

    modelWatchRef.current = setInterval(() => {
      const p = playerRefs.current[clipId];
      if (!p || !p.getCurrentTime) return;
      let t = 0;
      try { t = p.getCurrentTime() || 0; } catch (e) {}
      if (t >= pauseAt) {
        clearInterval(modelWatchRef.current);
        modelWatchRef.current = null;
        try { p.pauseVideo(); } catch (e) {}
      }
    }, 80);
  };

  // 🎙️ 버튼: 이 클립을 1회성 스픽 모드로 전환.
  // start_sec으로 되감아 1회차·1배속으로 처음부터 재생 → pause_at에서
  // 자동 정지 → 발화 플로우(armed→녹음→리뷰) 진입.
  const enterSpeakMode = (clipId: string) => {
    const clip = clipsRef.current.find(c => c.clip_id === clipId);
    if (!clip) return;

    // 🎙️ 버튼 클릭도 실제 제스처 — 소리 상호작용으로 인정 (안내 칩 해제)
    setHasInteracted(true);
    hasInteractedRef.current = true;

    // 진행 중이던 스픽 잔여물 정리 + 재발화 가능하도록 완료 플래그 해제
    resetSpeakArtifacts(clipId);
    spokenDoneRef.current = { ...spokenDoneRef.current, [clipId]: false };
    setSpokenDone(prev => ({ ...prev, [clipId]: false }));
    setSeqResult(prev => ({ ...prev, [clipId]: null }));

    setClipSpeakMode(clipId, true);
    // 1회차·1배속으로 고정 후 처음부터
    phasesRef.current = { ...phasesRef.current, [clipId]: 1 };
    setPhases(prev => ({ ...prev, [clipId]: 1 }));
    setPlaybackRates(prev => ({ ...prev, [clipId]: 1.0 }));

    const player = playerRefs.current[clipId];
    if (player) {
      try {
        player.setPlaybackRate(1.0);
        player.unMute();
        player.seekTo(Number(clip.start_sec || 0), true);
        player.playVideo();
        setIsPlaying(true);
        startMonitoring(clipId);
      } catch (e) {}
    }
  };

  // 5) "넘어가기" — 스픽 종료 후 쇼츠 모드로 복귀 (3회차 감속 루프 재개)
  const finishSpeak = (clipId: string) => {
    resetSpeakArtifacts(clipId);

    spokenDoneRef.current = { ...spokenDoneRef.current, [clipId]: true };
    setSpokenDone(prev => ({ ...prev, [clipId]: true }));
    setSeqResult(prev => ({ ...prev, [clipId]: null }));
    setWordFeedback(prev => { const n = { ...prev }; delete n[clipId]; return n; });
    // 1회성 스픽 종료 → 자동 쇼츠 모드 복귀
    setClipSpeakMode(clipId, false);

    const player = playerRefs.current[clipId];
    if (player && player.playVideo) {
      try {
        player.unMute();
        player.playVideo();
        setIsPlaying(true);
        startMonitoring(clipId);
      } catch (e) {}
    }
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

  // ── 마이 탭: 내 레벨/스트릭/구독 정보 로드 (player_dashboard 뷰) ──
  const loadMyStats = async () => {
    if (!playerId) return;
    setMyLoading(true);
    try {
      const { data } = await supabase
        .from('player_dashboard')
        .select('*')
        .eq('player_id', playerId)
        .maybeSingle();
      setMyStats(data || null);

      // 스픽 성공 이력(표현 레벨 계산) — RLS로 본인 행만 조회됨
      const { data: attempts } = await supabase
        .from('speak_attempts_log')
        .select('clip_id')
        .eq('passed', true);
      setPassedClips(new Set((attempts || []).map((a: any) => a.clip_id)));
    } catch (e) {
      console.error('[MyTab] load error:', e);
    } finally {
      setMyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my') loadMyStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, playerId]);

  // 공유: Web Share API → 실패 시 클립보드 복사
  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tal-english.vercel.app';
    const text = 'TAL English Up — 축구로 배우는 실전 영어 훈련소 ⚽️';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TAL English Up', text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setShareMsg('링크가 복사되었습니다!');
      setTimeout(() => setShareMsg(''), 2000);
    } catch (e) {
      // 사용자가 공유 취소한 경우 등 — 무시
    }
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



      {/* 모바일 스마트폰 목업 프레임 */}
      <div className={styles.phoneFrame}>
        <div className={styles.phoneNotch} />
        
        {/* 전역 탭을 상호작용으로 소모하지 않는다 — 탭 이동/스크롤만으로는
            hasInteracted가 켜지지 않아 "🔇 탭하여 소리 켜기" 안내가 노출되고,
            안내 버튼 또는 중앙 탭(실제 제스처)에서만 소리를 켠다. */}
        <div className={styles.phoneScreen}>
          
          <div style={{ display: activeTab === 'shorts' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* 상단 카테고리 필터바 복원 */}
            <div className={styles.presetBar}>
              <div className={styles.presetHeaderRow}>
                <div style={{ flex: 1 }} />
                <button 
                  type="button"
                  className={styles.listToggleBtn}
                  onClick={() => setIsListOpen(!isListOpen)}
                >
                  {isListOpen ? '필터 닫기 ▲' : '카테고리 필터 ☰'}
                </button>
              </div>
              
              {isListOpen && (
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
              )}
            </div>

            {/* 통합 쇼츠 상단 스트립: 세션 진행(⑧) · 연속 학습 게이지(⑥) · 핸즈프리(⑦) */}
            {activeTab === 'shorts' && clips.length > 0 && (() => {
              const sessionClips = clips.slice(0, 8);
              const doneCount = sessionClips.filter(c => spokenDone[c.clip_id]).length;
              const remaining = Math.max(0, DAILY_GOAL_SEC - dailyStudied);
              const goalPct = Math.min(100, (dailyStudied / DAILY_GOAL_SEC) * 100);
              return (
                <div className={styles.speakStrip}>
                  {/* ⑧ 세션 진행 세그먼트 */}
                  <div className={styles.sessionRow}>
                    <span className={styles.sessionLabel}>오늘의 스픽 {doneCount}/{sessionClips.length}</span>
                    <div className={styles.segmentBar}>
                      {sessionClips.map((c) => (
                        <span
                          key={c.clip_id}
                          className={`${styles.segment} ${spokenDone[c.clip_id] ? styles.segmentDone : ''} ${activePresetId === c.clip_id ? styles.segmentActive : ''}`}
                        />
                      ))}
                    </div>
                    {/* ⑦ 핸즈프리 토글 */}
                    <button
                      type="button"
                      className={`${styles.handsFreeBtn} ${handsFree ? styles.handsFreeOn : ''}`}
                      onClick={() => setHandsFree(v => !v)}
                    >
                      핸즈프리 {handsFree ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* ⑥ 연속 학습 불꽃 게이지 */}
                  <div className={styles.fireRow}>
                    <span className={styles.fireLabel}>
                      {goalCelebrated || remaining === 0
                        ? '🔥 오늘의 훈련 완료!'
                        : `🔥 오늘의 훈련 완료까지 ${remaining}초`}
                    </span>
                    <div className={styles.fireBar}>
                      <div className={styles.fireProgress} style={{ width: `${goalPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 수직 스냅 스크롤링 쇼츠 피드 */}
            <div
              ref={containerRef}
              className={styles.shortsContainer}
            >
              {clips.length > 0 ? (
                clips.map((clip) => {
                  const currentPhase = phases[clip.clip_id] || 1;
                  const rate = playbackRates[clip.clip_id] || 1.0;
                  const isCurrentActive = activePresetId === clip.clip_id;

                  // 재생바 구간 (진행률 계산/갱신은 ClipProgressBar가 자체 담당)
                  const startSec = Number(clip.start_sec || 0);
                  const endSec = Number(clip.end_sec || 0);

                  return (
                    <div 
                      key={clip.clip_id} 
                      id={`card-${clip.clip_id}`}
                      data-clip-id={clip.clip_id}
                      className={styles.shortsCard}
                    >
                      <div className={styles.videoArea}>
                        <div className={styles.youtubeWrapper}>
                          <div id={`yt-host-${clip.clip_id}`} className={styles.youtubeIframe}></div>
                        </div>

                        {/* 스픽 훈련 오버레이 (armed → recording → review) */}
                        {isCurrentActive && speakStage[clip.clip_id] && (
                          <div className={`${styles.lockOverlay} ${styles.overlayBlurActive}`}>
                            <div className={styles.lockContent}>

                              {/* ARMED: pause_at 자동 정지 → 원형 Speak 버튼 대기 */}
                              {speakStage[clip.clip_id] === 'armed' && (
                                <>
                                  <h3 className={styles.lockTitle}>지금 말할 차례!</h3>
                                  {/* ④ 말할 문장 힌트 — 흐리게 표시 */}
                                  <p className={styles.targetFaded}>{clip.target_phrase}</p>
                                  <button
                                    type="button"
                                    className={styles.speakCircleBtn}
                                    onClick={() => startSpeaking(clip.clip_id)}
                                  >
                                    <span className={styles.speakCircleIcon}>🎙️</span>
                                    <span className={styles.speakCircleLabel}>Speak</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.skipSeqBtn}
                                    style={{ marginTop: 18 }}
                                    onClick={() => finishSpeak(clip.clip_id)}
                                  >
                                    넘어가기 →
                                  </button>
                                </>
                              )}

                              {/* RECORDING: 즉시 녹음 중 (④ 문장 흐리게 유지) */}
                              {speakStage[clip.clip_id] === 'recording' && (
                                <>
                                  <p className={styles.targetFaded}>{clip.target_phrase}</p>
                                  <div className={styles.recordingBox}>
                                    <div className={styles.micCircleActive}>🎙️</div>
                                    <p className={styles.speakStageText} style={{ color: '#ef4444' }}>
                                      녹음 중... {recElapsed}초
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.speakButton}
                                    style={{ background: '#ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                                    onClick={stopSpeaking}
                                  >
                                    ■ 말하기 완료
                                  </button>
                                </>
                              )}

                              {/* REVIEW: ① 단어별 색상 피드백 + 결과 + 듣기 + ② 다시하기 + 넘어가기 */}
                              {speakStage[clip.clip_id] === 'review' && (
                                <>
                                  {/* ① target 각 단어를 맞음(초록)/틀림(회색)으로 표시 */}
                                  <p className={styles.targetWords}>
                                    {(wordFeedback[clip.clip_id] ??
                                      clip.target_phrase.split(' ').map((w: string) => ({ w, ok: false }))
                                    ).map((tok: { w: string; ok: boolean }, i: number) => (
                                      <span
                                        key={i}
                                        className={`${styles.wordChip} ${tok.ok ? styles.wordChipOk : styles.wordChipBad}`}
                                      >
                                        {tok.w}
                                      </span>
                                    ))}
                                  </p>

                                  {seqResult[clip.clip_id] == null ? (
                                    <div className={styles.evaluationBox}>
                                      <div className={styles.analyzingSpinner} />
                                      <p className={styles.speakStageText}>AI 발음 분석 중...</p>
                                    </div>
                                  ) : seqResult[clip.clip_id] === 'pass' ? (
                                    <div className={styles.evaluationSuccess}>
                                      <span className={styles.evalIcon}>✓</span>
                                      <p className={styles.speakStageText}>EXCELLENT! 합격 (XP +50점)</p>
                                    </div>
                                  ) : (
                                    <div className={styles.evaluationFail}>
                                      <span className={styles.evalIcon}>✗</span>
                                      <p className={styles.speakStageText}>다시 도전해볼까요?</p>
                                    </div>
                                  )}

                                  <div className={styles.reviewBtnRow}>
                                    <button
                                      type="button"
                                      className={styles.reviewBtn}
                                      disabled={!myAudioUrl}
                                      onClick={playMyRecording}
                                    >
                                      🔊 내 발음 듣기
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.reviewBtn}
                                      onClick={() => playModelAnswer(clip.clip_id)}
                                    >
                                      ⭐ 모범 답안 듣기
                                    </button>
                                  </div>

                                  {/* ② 다시하기 */}
                                  <div className={styles.reviewBtnRow}>
                                    <button
                                      type="button"
                                      className={styles.reviewBtn}
                                      style={{ borderColor: 'rgba(10,34,143,0.4)', color: '#0A228F' }}
                                      onClick={() => retrySpeak(clip.clip_id)}
                                    >
                                      ↺ 다시하기
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.reviewBtn}
                                      style={{ background: '#0A228F', border: 'none', color: '#ffffff' }}
                                      onClick={() => finishSpeak(clip.clip_id)}
                                    >
                                      넘어가기 →
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 메인 투명 오버레이 패널 */}
                        <div className={`${styles.overlay} ${!isPlaying ? styles.overlayPaused : ''}`}>
                          
                          {/* 상단 메타 바 - 배속 및 Advanced 토글 영상 상단 정렬 복원 */}
                          <div className={styles.topSection}>
                            {/* 스픽 모드는 1회차(1.0x)만 진행 → 감속 회차 배지 대신 실전 라벨 */}
                            <span className={styles.phaseBadge}>
                              {speakMode[clip.clip_id] ? '🎙️ 실전 스피킹' : `🔥 ${currentPhase}회차 (${rate.toFixed(2)}x)`}
                            </span>

                            <div
                              onClick={() => setSubtitleOn(!subtitleOn)}
                              className={`${styles.advToggle} ${subtitleOn ? styles.advActive : ''}`}
                            >
                              <span className={styles.advLabel}>
                                자막 {subtitleOn ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </div>

                          {/* 중앙 영역 — controls:1이므로 재생/정지는 네이티브 컨트롤이
                              처리한다. 이 영역은 클릭을 통과시켜(pointer-events:none)
                              플레이어가 직접 탭을 받도록 한다(컨트롤 가림 금지, 정책 준수). */}
                          <div className={styles.centerSection} />

                          {/* 하단 훈련 자막 및 컨트롤러 */}
                          <div className={styles.bottomSection}>
                            
                            <div className={styles.captionCard}>
                              {subtitleOn && (
                                <>
                                  {/* 영어(위) → 한글 번역(아래) */}
                                  <p className={styles.captionEn}>
                                    {clip.target_phrase}
                                  </p>
                                  {clip.translation && clip.translation.trim() !== '' && (
                                    <p className={styles.captionKr}>"{clip.translation}"</p>
                                  )}
                                </>
                              )}

                              <ClipProgressBar
                                getPlayer={() => playerRefs.current[clip.clip_id]}
                                startSec={startSec}
                                endSec={endSec}
                                active={isCurrentActive}
                                containerClassName={styles.timelineContainer}
                                barClassName={styles.timelineBar}
                                progressClassName={styles.timelineProgress}
                              />
                            </div>

                            {/* muted 안내 — 활성 클립이 실제로 음소거인 동안 매 영상 노출 */}
                            {isCurrentActive && isSoundMuted && !speakMode[clip.clip_id] && !speakStage[clip.clip_id] && (
                              <button
                                type="button"
                                className={styles.soundHint}
                                onClick={(e) => { e.stopPropagation(); enableSound(clip.clip_id); }}
                              >
                                🔇 탭하여 소리 켜기
                              </button>
                            )}

                            {speakMode[clip.clip_id] && !speakStage[clip.clip_id] && (
                              <div className={styles.actionArea}>
                                <div className={styles.speakHintText}>
                                  🎙️ 지정 시점에서 자동으로 멈추면 말하기가 시작됩니다
                                </div>
                              </div>
                            )}

                            {/* 우하단 스픽 FAB — 누르면 이 영상만 1회성 스픽 모드 */}
                            {isCurrentActive && !speakStage[clip.clip_id] && !speakMode[clip.clip_id] && (
                              <button
                                type="button"
                                className={styles.speakFab}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enterSpeakMode(clip.clip_id);
                                }}
                              >
                                🎙️ Speak
                              </button>
                            )}
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

          {/* 홈 탭 — 앱 활용 가이드 */}
          {activeTab === 'home' && (
            <div className={styles.homeTab}>
              <div className={styles.homeHero}>
                <div className={styles.homeHeroIcon}>⚽️</div>
                <h1 className={styles.homeHeroTitle}>TAL English Up</h1>
                <p className={styles.homeHeroSub}>축구 인터뷰로 배우는 실전 영어 훈련소</p>
              </div>

              <div className={styles.homeSectionTitle}>이렇게 활용하세요</div>

              {/* AI 코치 도슨트 가이드 (영상) — 쇼츠 쉐도잉(귀 트기), Speak 발화 훈련,
                  선수 카드 수집, 매일 성장까지 모든 사용법을 이 한 영상에 담는다.
                  개별 스텝 안내 박스는 제거하고 영상으로 통합. */}
              <GuideDocent />

              <button
                type="button"
                className={styles.homeStartBtn}
                onClick={() => setActiveTab('shorts')}
              >
                🎬 지금 훈련 시작하기
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

          {/* 마이 탭 — 내 레벨/학습/공유 */}
          {activeTab === 'my' && (() => {
            const s = myStats || {};
            const xp = s.xp ?? 0;
            const streakDays = s.streak_days ?? 0;

            // ── 표현 레벨: 레벨당 5개 표현(=스픽 클립)을 모두 통과하면 다음 레벨 ──
            const EXPR_PER_LEVEL = 5;
            const MAX_LEVEL = 20;
            const expressions = clips; // 스픽 클립(순서 = 표현 순서)
            let exprLevel = 1;
            for (let L = 1; L <= MAX_LEVEL; L++) {
              const grp = expressions.slice((L - 1) * EXPR_PER_LEVEL, L * EXPR_PER_LEVEL);
              exprLevel = L;
              if (grp.length === 0) break; // 더 이상 표현 없음
              if (!grp.every((c: any) => passedClips.has(c.clip_id))) break; // 이 레벨 미완료 = 현재 레벨
              // 이 레벨 완료 → 다음 레벨 확인 (마지막 레벨이면 유지)
            }
            const curGroup = expressions.slice((exprLevel - 1) * EXPR_PER_LEVEL, exprLevel * EXPR_PER_LEVEL);
            const doneInLevel = curGroup.filter((c: any) => passedClips.has(c.clip_id)).length;
            const levelPct = curGroup.length > 0 ? Math.round((doneInLevel / curGroup.length) * 100) : 100;
            const remainInLevel = Math.max(0, curGroup.length - doneInLevel);
            const week: boolean[] = Array.isArray(s.streak_week) ? s.streak_week : [false, false, false, false, false, false, false];
            const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
            const displayName = s.display_name || '풋볼러';
            const email = s.email || '';
            const sub = s.subscription_status || 'free';
            const unlockedCards = Object.values(successCounts).filter(v => (v as number) > 0).length;

            return (
              <div className={styles.myTab}>
                {/* 프로필 헤더 */}
                <div className={styles.myHeader}>
                  <div className={styles.myAvatar}>
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className={styles.myAvatarImg} /> : '⚽️'}
                  </div>
                  <div className={styles.myName}>{displayName}</div>
                  {email && <div className={styles.myEmail}>{email}</div>}
                  <span className={styles.mySubBadge}>{sub === 'free' ? '무료 플랜' : sub.toUpperCase()}</span>
                </div>

                {myLoading && <div className={styles.myHint}>내 정보를 불러오는 중...</div>}

                {/* 표현 레벨 — 레벨당 5개 표현 완료 시 다음 레벨 */}
                <div className={styles.myCard}>
                  <div className={styles.myCardRow}>
                    <span className={styles.myLevelBadge}>레벨 {exprLevel} / {MAX_LEVEL}</span>
                    <span className={styles.myXpText}>이번 레벨 {doneInLevel} / {curGroup.length || EXPR_PER_LEVEL} 완료</span>
                  </div>
                  <div className={styles.myXpBar}>
                    <div className={styles.myXpFill} style={{ width: `${levelPct}%` }} />
                  </div>

                  <div className={styles.exprList}>
                    {curGroup.length === 0 ? (
                      <div className={styles.myHint} style={{ textAlign: 'center' }}>🎉 모든 표현을 완료했어요!</div>
                    ) : (
                      curGroup.map((c: any) => {
                        const done = passedClips.has(c.clip_id);
                        return (
                          <div key={c.clip_id} className={styles.exprItem}>
                            <span className={`${styles.exprCheck} ${done ? styles.exprCheckDone : ''}`}>
                              {done ? '✓' : ''}
                            </span>
                            <span className={`${styles.exprText} ${done ? styles.exprTextDone : ''}`}>
                              {c.target_phrase || c.title_ko || c.clip_id}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {curGroup.length > 0 && (
                    <div className={styles.myHint} style={{ marginTop: 10, marginBottom: 0 }}>
                      {remainInLevel > 0
                        ? `다음 레벨까지 ${remainInLevel}개 표현 남았어요`
                        : '이 레벨 완료! 다음 레벨로 이동합니다'}
                    </div>
                  )}
                </div>

                {/* 요일 스트릭 */}
                <div className={styles.myCard}>
                  <div className={styles.myCardTitle}>🔥 연속 학습 {streakDays}일</div>
                  <div className={styles.myWeekRow}>
                    {dayLabels.map((d, i) => (
                      <div key={i} className={styles.myDayCol}>
                        <span className={`${styles.myDayDot} ${week[i] ? styles.myDayDotOn : ''}`}>
                          {week[i] ? '✓' : ''}
                        </span>
                        <span className={styles.myDayLabel}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 학습 콘텐츠 요약 */}
                <div className={styles.myCard}>
                  <div className={styles.myCardTitle}>📚 내 학습 콘텐츠</div>
                  <div className={styles.myStatGrid}>
                    <div className={styles.myStatItem}>
                      <div className={styles.myStatNum}>{passedClips.size}</div>
                      <div className={styles.myStatLabel}>완료 표현</div>
                    </div>
                    <div className={styles.myStatItem}>
                      <div className={styles.myStatNum}>{xp.toLocaleString()}</div>
                      <div className={styles.myStatLabel}>누적 XP</div>
                    </div>
                    <div className={styles.myStatItem}>
                      <div className={styles.myStatNum}>{unlockedCards}</div>
                      <div className={styles.myStatLabel}>획득 카드</div>
                    </div>
                  </div>
                </div>

                {/* 공유 */}
                <div className={styles.myCard}>
                  <div className={styles.myCardTitle}>🎁 친구에게 공유</div>
                  <p className={styles.myHint}>친구를 초대하고 함께 축구 영어를 훈련하세요.</p>
                  <button type="button" className={styles.speakButton} onClick={handleShare}>
                    📤 앱 공유하기
                  </button>
                  {shareMsg && <div className={styles.myShareMsg}>{shareMsg}</div>}
                </div>

                {/* 로그아웃 */}
                <button type="button" className={styles.myLogoutBtn} onClick={handleLogout}>
                  로그아웃 (Sign Out)
                </button>
              </div>
            );
          })()}

          {/* 하단 고정 탭 바 */}
          <div className={styles.bottomTabBar}>
            <button
              className={`${styles.tabItem} ${activeTab === 'home' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span className={styles.tabIcon}>🏠</span>
              <span className={styles.tabLabel}>홈</span>
            </button>
            <button
              className={`${styles.tabItem} ${activeTab === 'shorts' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('shorts')}
            >
              <span className={styles.tabIcon}>🎬</span>
              <span className={styles.tabLabel}>쇼츠 모드</span>
            </button>
            <button
              className={`${styles.tabItem} ${activeTab === 'collection' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('collection')}
            >
              <span className={styles.tabIcon}>📦</span>
              <span className={styles.tabLabel}>Collection</span>
            </button>
            <button
              className={`${styles.tabItem} ${activeTab === 'my' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('my')}
            >
              <span className={styles.tabIcon}>👤</span>
              <span className={styles.tabLabel}>마이</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
