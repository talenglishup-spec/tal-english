/**
 * ClipProgressBar
 *
 * 재생 진행바. 이전에는 부모(ShortsPage)가 currentTimes state를 매 프레임
 * 갱신해서 피드 전체가 초당 수십 번 리렌더됐다. 진행바만 자체 rAF 루프로
 * YouTube Player의 현재 시각을 폴링해 바 너비만 갱신하도록 분리하여,
 * 부모 피드의 불필요한 리렌더를 제거한다.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ClipProgressBarProps {
    /** 현재 클립의 YouTube Player 인스턴스를 반환 (없으면 null) */
    getPlayer: () => any;
    startSec: number;
    endSec: number;
    /** 활성 클립일 때만 폴링 (비활성 카드는 정지) */
    active: boolean;
    barClassName: string;
    progressClassName: string;
    containerClassName: string;
}

export default function ClipProgressBar({
    getPlayer,
    startSec,
    endSec,
    active,
    barClassName,
    progressClassName,
    containerClassName,
}: ClipProgressBarProps) {
    const [percent, setPercent] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!active) {
            setPercent(0);
            return;
        }

        const duration = Math.max(1, endSec - startSec);

        const loop = () => {
            const player = getPlayer();
            if (player && player.getCurrentTime) {
                try {
                    const t = player.getCurrentTime() || 0;
                    const elapsed = Math.max(0, t - startSec);
                    setPercent(Math.min(100, (elapsed / duration) * 100));
                } catch (e) {}
            }
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [active, getPlayer, startSec, endSec]);

    return (
        <div className={containerClassName}>
            <div className={barClassName}>
                <div className={progressClassName} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
