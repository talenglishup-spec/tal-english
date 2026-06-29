/**
 * useYouTubePlayer
 *
 * YouTube IFrame API hook for TAL Shorts + Speak mode.
 *
 * Features:
 *   • Loads YouTube IFrame API once (global singleton)
 *   • 3-stage playback: 1.0x (full) → 0.75x loop (highlight) → 0.5x loop (slow)
 *   • 100ms polling via requestAnimationFrame for pauseAt detection
 *   • Speak mode: auto-pause at `pauseAt` seconds → fires onSpeakTrigger callback
 *   • Exposes: play, pause, seekTo, setStage, setPlaybackRate, getCurrentTime
 *
 * Usage:
 *   const { playerRef, isReady, stage, setStage, play, pause, seekTo } =
 *       useYouTubePlayer({ videoId, pauseAt: 12.5, onSpeakTrigger: handleSpeak });
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ── YouTube IFrame API types ───────────────────────────────────
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// ── Playback stages ───────────────────────────────────────────
export type PlaybackStage = 1 | 2 | 3;

const STAGE_RATES: Record<PlaybackStage, number> = {
    1: 1.0,    // Full speed — first viewing
    2: 0.75,   // Slower — highlight loop (0.7 not supported, use 0.75)
    3: 0.5,    // Slowest — deep practice loop
};

// ── Hook options ──────────────────────────────────────────────
export interface UseYouTubePlayerOptions {
    /** YouTube video ID (not URL) */
    videoId: string;
    /** Seconds at which to auto-pause for Speak mode (0 = disabled) */
    pauseAt?: number;
    /** Start time in seconds (default: 0) */
    startAt?: number;
    /** End time in seconds for loop mode (0 = no end) */
    endAt?: number;
    /** Called when video reaches pauseAt — trigger Speak mode overlay */
    onSpeakTrigger?: () => void;
    /** Called when playback state changes */
    onStateChange?: (state: number) => void;
    /** Whether to mute (for background/autoplay). Default: false */
    muted?: boolean;
    /** Whether to autoplay on load. Default: false */
    autoplay?: boolean;
}

// ── Hook return value ─────────────────────────────────────────
export interface UseYouTubePlayerReturn {
    /** Ref to attach to the <div id="..."> container */
    containerRef: React.RefObject<HTMLDivElement>;
    /** True once YT player is fully initialised */
    isReady: boolean;
    /** Current playback stage (1/2/3) */
    stage: PlaybackStage;
    /** Current time in seconds (updated every 100ms) */
    currentTime: number;
    /** Whether currently playing */
    isPlaying: boolean;
    /** Whether speak trigger has fired (cleared on resume) */
    speakTriggered: boolean;

    // Controls
    play:           () => void;
    pause:          () => void;
    seekTo:         (seconds: number) => void;
    setStage:       (stage: PlaybackStage) => void;
    setPlaybackRate: (rate: number) => void;
    resumeAfterSpeak: () => void;
    unMute:          () => void;
    destroyPlayer:  () => void;
}

// ── Singleton API loader ──────────────────────────────────────
let apiLoaded   = false;
let apiLoading  = false;
const callbacks: Array<() => void> = [];

function loadYouTubeAPI(onReady: () => void) {
    if (apiLoaded) { onReady(); return; }
    callbacks.push(onReady);
    if (apiLoading) return;

    apiLoading = true;
    const script  = document.createElement('script');
    script.src    = 'https://www.youtube.com/iframe_api';
    script.async  = true;
    document.head.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
        apiLoaded  = true;
        apiLoading = false;
        callbacks.forEach(cb => cb());
        callbacks.length = 0;
    };
}

// ── Hook ──────────────────────────────────────────────────────
export function useYouTubePlayer(opts: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
    const {
        videoId,
        pauseAt       = 0,
        startAt       = 0,
        endAt         = 0,
        onSpeakTrigger,
        onStateChange,
        muted         = false,
        autoplay      = false,
    } = opts;

    const containerRef    = useRef<HTMLDivElement>(null);
    const playerRef       = useRef<any>(null);
    const pollRef         = useRef<number | null>(null);
    const speakFiredRef   = useRef(false); // prevent double-fire per clip

    // ── Refs for polling loop (stale closure 방지) ────────────
    // startPolling은 onReady 시 1회만 호출되므로 클로저로 캡처된 값이 stale해짐.
    // stage/pauseAt/startAt/endAt은 이후 변경될 수 있으므로 ref로 항상 최신값 유지.
    const stageRef          = useRef<PlaybackStage>(1);
    const pauseAtRef        = useRef(pauseAt);
    const startAtRef        = useRef(startAt);
    const endAtRef          = useRef(endAt);
    const onSpeakTriggerRef = useRef(onSpeakTrigger);

    // opts가 바뀔 때마다 ref 동기화
    useEffect(() => { pauseAtRef.current = pauseAt; }, [pauseAt]);
    useEffect(() => { startAtRef.current = startAt; }, [startAt]);
    useEffect(() => { endAtRef.current = endAt; }, [endAt]);
    useEffect(() => { onSpeakTriggerRef.current = onSpeakTrigger; }, [onSpeakTrigger]);

    const [isReady,        setIsReady]        = useState(false);
    const [stage,          setStageState]     = useState<PlaybackStage>(1);
    const [currentTime,    setCurrentTime]    = useState(0);
    const [isPlaying,      setIsPlaying]      = useState(false);
    const [speakTriggered, setSpeakTriggered] = useState(false);

    // ── Controls ────────────────────────────────────────────
    const play = useCallback(() => {
        playerRef.current?.playVideo();
    }, []);

    const pause = useCallback(() => {
        playerRef.current?.pauseVideo();
    }, []);

    const seekTo = useCallback((seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
    }, []);

    const setPlaybackRate = useCallback((rate: number) => {
        playerRef.current?.setPlaybackRate(rate);
    }, []);

    const setStage = useCallback((newStage: PlaybackStage) => {
        stageRef.current = newStage; // ref 먼저 동기화 → 폴링 루프가 즉시 최신값 참조
        setStageState(newStage);
        playerRef.current?.setPlaybackRate(STAGE_RATES[newStage]);
    }, []);

    const resumeAfterSpeak = useCallback(() => {
        setSpeakTriggered(false);
        speakFiredRef.current = false; // allow future triggers on loop
        playerRef.current?.playVideo();
    }, []);

    const unMute = useCallback(() => {
        playerRef.current?.unMute();
    }, []);

    const destroyPlayer = useCallback(() => {
        if (pollRef.current) cancelAnimationFrame(pollRef.current);
        playerRef.current?.destroy();
        playerRef.current = null;
        setIsReady(false);
    }, []);

    // ── 100ms polling loop ────────────────────────────────────
    // 의존성 배열 없음 — 모든 변경값은 ref를 통해 최신값 참조 (stale closure 완전 해결)
    const startPolling = useCallback(() => {
        let last = 0;

        const poll = () => {
            if (!playerRef.current) return;

            const now = Date.now();
            if (now - last >= 100) {
                last = now;
                try {
                    const t        = playerRef.current.getCurrentTime() || 0;
                    const curStage = stageRef.current;
                    const curEnd   = endAtRef.current;
                    const curStart = startAtRef.current;
                    const curPause = pauseAtRef.current;

                    setCurrentTime(t);

                    // Stage 2/3: loop within [startAt, endAt]
                    if ((curStage === 2 || curStage === 3) && curEnd > 0 && t >= curEnd) {
                        playerRef.current.seekTo(curStart, true);
                    }

                    // Speak mode: auto-pause at pauseAt
                    if (
                        curPause > 0 &&
                        !speakFiredRef.current &&
                        t >= curPause &&
                        playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING
                    ) {
                        speakFiredRef.current = true;
                        playerRef.current.pauseVideo();
                        setSpeakTriggered(true);
                        onSpeakTriggerRef.current?.();
                    }
                } catch {
                    // player may not be ready yet — ignore
                }
            }

            pollRef.current = requestAnimationFrame(poll);
        };

        pollRef.current = requestAnimationFrame(poll);
    }, []); // 의존성 없음 — ref로 최신값 직접 참조

    // ── Init player ───────────────────────────────────────────
    useEffect(() => {
        if (!videoId) return;

        const initPlayer = () => {
            if (!containerRef.current) return;

            // Clean up existing player
            playerRef.current?.destroy();
            playerRef.current = null;
            if (pollRef.current) cancelAnimationFrame(pollRef.current);
            speakFiredRef.current = false;

            playerRef.current = new window.YT.Player(containerRef.current, {
                videoId,
                playerVars: {
                    autoplay:       autoplay ? 1 : 0,
                    controls:       1,
                    rel:            0,
                    modestbranding: 1,
                    playsinline:    1,   // required for iOS inline play
                    enablejsapi:    1,
                    start:          startAt,
                    mute:           muted ? 1 : 0,
                    // Shorts use portrait aspect — caller controls container size
                },
                events: {
                    onReady: () => {
                        setIsReady(true);
                        playerRef.current?.setPlaybackRate(STAGE_RATES[1]);
                        startPolling();
                    },
                    onStateChange: (e: any) => {
                        const playing = e.data === window.YT.PlayerState.PLAYING;
                        setIsPlaying(playing);
                        onStateChange?.(e.data);
                    },
                    onError: (e: any) => {
                        console.error('[useYouTubePlayer] YT error:', e.data);
                    },
                },
            });
        };

        loadYouTubeAPI(initPlayer);

        return () => {
            if (pollRef.current) cancelAnimationFrame(pollRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]); // re-init only when videoId changes

    // ── Sync stage rate changes ───────────────────────────────
    useEffect(() => {
        if (isReady) {
            playerRef.current?.setPlaybackRate(STAGE_RATES[stage]);
        }
    }, [stage, isReady]);

    return {
        containerRef,
        isReady,
        stage,
        currentTime,
        isPlaying,
        speakTriggered,
        play,
        pause,
        seekTo,
        setStage,
        setPlaybackRate,
        resumeAfterSpeak,
        unMute,
        destroyPlayer,
    };
}

// ── Stage cycle helper ────────────────────────────────────────
/** Returns the next stage in the 1→2→3→1 cycle */
export function nextStage(current: PlaybackStage): PlaybackStage {
    return current === 3 ? 1 : ((current + 1) as PlaybackStage);
}

export { STAGE_RATES };
