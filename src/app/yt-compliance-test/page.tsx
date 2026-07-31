'use client';

/**
 * /yt-compliance-test
 *
 * YouTube 정책 준수 테스트 페이지.
 * 실제 ShortsExperience는 건드리지 않고, 컴플라이언스 수정사항만 적용한
 * 테스트 카드를 나란히 보여줍니다.
 *
 * 비교 항목:
 *   [현재] controls:0 + pointer-events:none + 상하좌우 크롭 (위반)
 *   [수정] controls:1 + pointer-events:auto + 좌우만 크롭 (준수)
 */

import React, { useEffect, useRef, useState } from 'react';

// 테스트용 영상 (공개 축구 영상)
const TEST_VIDEO_ID = 'ro85pVBq9Xs';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let ytApiLoaded = false;
let ytApiLoading = false;
const ytCallbacks: Array<() => void> = [];

function loadYTApi(cb: () => void) {
  if (ytApiLoaded) { cb(); return; }
  ytCallbacks.push(cb);
  if (ytApiLoading) return;
  ytApiLoading = true;
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  document.head.appendChild(s);
  window.onYouTubeIframeAPIReady = () => {
    ytApiLoaded = true;
    ytApiLoading = false;
    ytCallbacks.forEach(f => f());
    ytCallbacks.length = 0;
  };
}

// ── 개별 플레이어 카드 ──────────────────────────────────────────
interface CardProps {
  title: string;
  subtitle: string;
  controls: 0 | 1;
  cropVertical: boolean;   // true = 상하 42.5% 크롭 (현재), false = 좌우만 크롭 (수정)
  pointerEvents: 'none' | 'auto';
  badgeColor: string;
  badgeText: string;
  badgeEmoji: string;
  notes: string[];
}

function PlayerCard({
  title, subtitle, controls, cropVertical,
  pointerEvents, badgeColor, badgeText, badgeEmoji, notes,
}: CardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadYTApi(() => {
      if (!hostRef.current) return;
      const mountDiv = document.createElement('div');
      hostRef.current.appendChild(mountDiv);
      playerRef.current = new window.YT.Player(mountDiv, {
        videoId: TEST_VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => setReady(true),
        },
      });
    });
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iframeStyle: React.CSSProperties = cropVertical
    ? {
        width: '185%',
        height: '185%',
        position: 'absolute',
        top: '-42.5%',
        left: '-42.5%',
        pointerEvents,
      }
    : {
        width: '185%',
        height: '100%',
        position: 'absolute',
        top: '0',
        left: '-42.5%',
        pointerEvents,
      };

  return (
    <div style={cardStyle}>
      {/* 뱃지 */}
      <div style={{ ...badgeStyle, background: badgeColor }}>
        {badgeEmoji} {badgeText}
      </div>

      {/* 제목 */}
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>{title}</span>
        <span style={cardSubStyle}>{subtitle}</span>
      </div>

      {/* 영상 박스 */}
      <div style={videoWrapStyle}>
        <div ref={hostRef} style={iframeStyle} />

        {/* 커스텀 오버레이 (TAL 실제 UI 시뮬레이션) */}
        <div style={overlayStyle}>
          {/* 상단 */}
          <div style={overlayTopStyle}>
            <span style={playerTagStyle}>SONNY • FW</span>
            <span style={subtypeBadgeStyle}>post_match</span>
          </div>
          {/* 중앙 탭 영역 */}
          <div
            style={centerTapStyle}
            onClick={() => {
              if (!ready) return;
              const state = playerRef.current?.getPlayerState?.();
              if (state === 1) playerRef.current?.pauseVideo();
              else playerRef.current?.playVideo();
            }}
          />
          {/* 하단 자막 */}
          <div style={overlayBottomStyle}>
            <p style={captionStyle}>"Look around!"</p>
            <div style={stageRowStyle}>
              <span style={stageDotActiveStyle} /> 1단계(1.0x)
            </div>
          </div>
        </div>
      </div>

      {/* 노트 */}
      <ul style={noteListStyle}>
        {notes.map((n, i) => <li key={i} style={noteItemStyle}>{n}</li>)}
      </ul>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function YtComplianceTestPage() {
  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={h1Style}>YouTube 정책 준수 테스트</h1>
        <p style={descStyle}>
          왼쪽: 현재 ShortsExperience (정책 위반) &nbsp;|&nbsp;
          오른쪽: 수정 후 (정책 준수)<br />
          실제 앱 파일은 변경하지 않은 테스트 전용 페이지입니다.
        </p>
        <div style={ruleBoxStyle}>
          <strong>적용된 변경사항 (오른쪽 카드)</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', lineHeight: 1.7 }}>
            <li><code>controls: 1</code> — YouTube 컨트롤바 표시</li>
            <li><code>pointer-events: auto</code> — iframe 클릭 허용</li>
            <li>세로 크롭 제거 → 좌우만 42.5% 크롭 유지 (세로형 느낌 보존)</li>
            <li><code>disablekb</code>, <code>fs: 0</code>, <code>showinfo</code>, <code>modestbranding</code> 제거</li>
            <li><code>origin</code> 파라미터 추가</li>
          </ul>
        </div>
      </div>

      <div style={cardsRowStyle}>
        {/* ── 현재 (위반) ── */}
        <PlayerCard
          title="현재 ShortsExperience"
          subtitle="정책 위반 상태"
          controls={0}
          cropVertical={true}
          pointerEvents="none"
          badgeColor="#dc2626"
          badgeText="위반"
          badgeEmoji="🚫"
          notes={[
            '🚫 controls: 0 — 컨트롤바 비활성',
            '🚫 pointer-events: none — 클릭 차단',
            '🚫 상하좌우 크롭 — 컨트롤바가 잘려서 안 보임',
            '🚫 disablekb: 1 — 키보드 단축키 비활성',
            '🚫 fs: 0 — 전체화면 버튼 없음',
          ]}
        />

        {/* ── 수정 후 (준수) ── */}
        <PlayerCard
          title="수정 후 (준수)"
          subtitle="YouTube 정책 준수 상태"
          controls={1}
          cropVertical={false}
          pointerEvents="auto"
          badgeColor="#16a34a"
          badgeText="준수"
          badgeEmoji="✅"
          notes={[
            '✅ controls: 1 — 컨트롤바 표시됨',
            '✅ pointer-events: auto — 클릭 가능',
            '✅ 좌우만 크롭 — 세로형 느낌 유지, 컨트롤바 표시',
            '✅ 키보드 단축키 작동 (스페이스바, 방향키)',
            '✅ 전체화면 버튼 표시됨',
            '✅ origin 파라미터 추가',
          ]}
        />
      </div>

      <div style={footerNoteStyle}>
        ℹ️ 커스텀 오버레이(선수명·자막·1단계 표시)는 두 카드 모두 동일하게 작동합니다.
        수정 후에도 탭으로 재생/정지, 스픽 모드, 배속 전환 기능은 그대로 유지됩니다.
      </div>
    </div>
  );
}

// ── 스타일 ──────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0A0E1A',
  color: '#fff',
  fontFamily: "'Inter', sans-serif",
  padding: '24px 16px 60px',
};

const headerStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto 32px',
};

const h1Style: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 800,
  marginBottom: '8px',
};

const descStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.875rem',
  lineHeight: 1.6,
  marginBottom: '16px',
};

const ruleBoxStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '10px',
  padding: '14px 18px',
  fontSize: '0.8rem',
  color: '#cbd5e1',
};

const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  maxWidth: '900px',
  margin: '0 auto',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const cardStyle: React.CSSProperties = {
  flex: '1 1 360px',
  maxWidth: '400px',
  background: '#111827',
  borderRadius: '16px',
  overflow: 'hidden',
  border: '1px solid #1e293b',
};

const badgeStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '0.8rem',
  fontWeight: 700,
  textAlign: 'center',
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '10px 14px 6px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#f1f5f9',
};

const cardSubStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
};

const videoWrapStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '9/14',
  overflow: 'hidden',
  background: '#000',
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 10,
  pointerEvents: 'none',
};

const overlayTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
  pointerEvents: 'none',
};

const playerTagStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#fff',
};

const subtypeBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 600,
  color: '#93c5fd',
  background: 'rgba(59,130,246,0.25)',
  padding: '2px 8px',
  borderRadius: '99px',
};

const centerTapStyle: React.CSSProperties = {
  flex: 1,
  pointerEvents: 'auto',
  cursor: 'pointer',
};

const overlayBottomStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
  pointerEvents: 'none',
};

const captionStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#fff',
  margin: '0 0 4px',
};

const stageRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.7rem',
  color: '#94a3b8',
};

const stageDotActiveStyle: React.CSSProperties = {
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  background: '#3b82f6',
  display: 'inline-block',
};

const noteListStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px 14px',
  listStyle: 'none',
  borderTop: '1px solid #1e293b',
};

const noteItemStyle: React.CSSProperties = {
  fontSize: '0.73rem',
  color: '#94a3b8',
  lineHeight: 1.8,
};

const footerNoteStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '24px auto 0',
  fontSize: '0.8rem',
  color: '#475569',
  textAlign: 'center',
  lineHeight: 1.6,
};
