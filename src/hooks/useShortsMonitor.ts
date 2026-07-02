/**
 * useShortsMonitor
 *
 * /shorts 피드의 "현재 재생 중인 단 한 개" 클립을 감시하는 재생 엔진.
 *
 * 이전에는 이 로직이 shorts/page.tsx 안에 직접 박혀 있었고, /workout이 쓰는
 * useYouTubePlayer 훅과 별개로 중복 구현되어 있어 같은 버그를 두 번 고쳐야
 * 했다. 재생 감시 로직(배속 3단계 전이, pause_at 자동 정지, 버퍼링 가드,
 * 시작점 보정)을 이 훅 하나로 모아 단일 소스로 관리한다.
 *
 * 설계 원칙:
 *   • setInterval 재시작 방식이 아니라 끊기지 않는 단일 requestAnimationFrame
 *     루프. 배속/구간이 바뀌어도 루프를 멈추지 않는다.
 *   • 루프 내부에서 참조하는 값은 전부 getter(콜백)로 받아 stale closure를
 *     원천 차단한다.
 */

'use client';

import { useCallback, useRef } from 'react';

// 3단계 감속 배속 (0.7은 YouTube 미지원 → 0.75 사용)
const PHASE_RATES: Record<number, number> = { 1: 1.0, 2: 0.75, 3: 0.5 };

/** 1 → 2 → 3 → 1 순환 */
function nextPhaseOf(phase: number): number {
    return phase >= 3 ? 1 : phase + 1;
}

export interface ShortsMonitorConfig {
    /** 현재 감시 대상 클립의 YouTube Player 인스턴스를 반환 */
    getPlayer: () => any;
    /** 재생 구간(초) */
    start: number;
    end: number;
    pauseAt: number;
    /** 폴링 시점의 최신 회차(phase)를 반환 (stale 방지) */
    getPhase: () => number;
    /** 스픽 자동 정지를 지금 발동해도 되는 상태인지 (탭=speak & 시퀀스 idle & 미완료) */
    shouldAutoPause: () => boolean;
    /** pause_at 도달로 자동 정지가 발동됐을 때 (발화 시퀀스 시작 트리거) */
    onAutoPause: (phase: number) => void;
    /** 구간 끝 도달 → 다음 회차로 전이됐을 때 (state/UI 갱신용) */
    onPhaseChange: (phase: number, rate: number) => void;
    /** 매 프레임 현재 재생 위치 (선택) */
    onTimeUpdate?: (t: number) => void;
}

export interface ShortsMonitorHandle {
    start: (cfg: ShortsMonitorConfig) => void;
    stop: () => void;
}

export function useShortsMonitor(): ShortsMonitorHandle {
    const rafRef = useRef<number | null>(null);

    const stop = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const start = useCallback((cfg: ShortsMonitorConfig) => {
        // 기존 루프가 있으면 정리 (동시에 두 개가 돌지 않도록)
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        const { start: startSec, end: endSec, pauseAt } = cfg;
        // start/end 데이터 누락(0 또는 역전) 시 매 프레임 "구간 끝 도달"로
        // 오인식되어 seekTo가 무한 반복되는 것을 막는 유효성 가드.
        const hasValidRange = endSec > startSec;

        // 구간 끝 전이를 막 실행한 직후에는 seekTo(start)가 아직 적용되지
        // 않아 getCurrentTime()이 잠깐 end 근처 값을 계속 돌려준다. 이 짧은
        // 창에서 "또 end 도달"로 오인되어 다음 회차(예: 3회차)가 즉시
        // 건너뛰어지던 버그가 있었다. 재생 위치가 end 구간을 확실히 벗어난
        // 뒤에야 다시 전이를 허용하도록 래치(armedForEnd)를 둔다.
        let armedForEnd = true;

        const tick = () => {
            const player = cfg.getPlayer();
            if (!player || !player.getCurrentTime) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            // 버퍼링(3)/미시작(-1)일 땐 시간 판독이 부정확하므로 보정 스킵
            let playerState = -1;
            try {
                playerState = player.getPlayerState();
            } catch (e) {}
            if (playerState === 3 || playerState === -1) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            let currTime = 0;
            try {
                currTime = player.getCurrentTime() || 0;
            } catch (e) {}
            cfg.onTimeUpdate?.(currTime);

            const currentPhase = cfg.getPhase();

            // 재생 위치가 end 구간을 확실히 벗어나면 다음 전이를 재무장
            if (currTime < endSec - 0.4) {
                armedForEnd = true;
            }

            // 스픽 자동 정지: pause_at 도달 시 영상을 멈추고 루프를 종료한다.
            // (발화가 끝나면 페이지가 startMonitoring으로 루프를 다시 시작)
            if (pauseAt > 0 && currTime >= pauseAt && cfg.shouldAutoPause()) {
                try {
                    player.pauseVideo();
                } catch (e) {}
                rafRef.current = null;
                cfg.onAutoPause(currentPhase);
                return;
            }

            // 구간 끝 도달 → 다음 회차로 전이 (배속 감속 후 시작점으로 되감기)
            if (hasValidRange && armedForEnd && currTime >= endSec) {
                armedForEnd = false; // seek 적용 확인 전까지 재전이 잠금
                const nextPhase = nextPhaseOf(currentPhase);
                const nextRate = PHASE_RATES[nextPhase] ?? 1.0;
                try {
                    player.seekTo(startSec, true);
                    player.setPlaybackRate(nextRate);
                } catch (e) {}
                cfg.onPhaseChange(nextPhase, nextRate);
            } else if (currTime < startSec - 0.5) {
                // 시작점보다 앞서 있을 때만 보정 점프 (0.5초 마진으로 무한루프 방지)
                try {
                    player.seekTo(startSec, true);
                } catch (e) {}
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    return { start, stop };
}

export { PHASE_RATES };
