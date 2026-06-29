'use client';

import React from 'react';

interface CardProgressProps {
  cardId: string;
  pieceCount: number;
  totalPieces?: number;
  unlocked: boolean;
  playerName: string;
}

export default function CardProgress({ cardId, pieceCount, totalPieces = 30, unlocked, playerName }: CardProgressProps) {
  const percentage = Math.round((pieceCount / totalPieces) * 100);

  return (
    <div style={containerStyle}>
      {/* FUT 카드 형태의 프레임 */}
      <div style={{ ...cardFrameStyle, ...(!unlocked ? lockedCardStyle : unlockedCardStyle) }}>
        <div style={cardHeaderStyle}>
          <span style={ovrStyle}>{unlocked ? 'OVR 88' : 'OVR ??'}</span>
          <span style={posStyle}>FW</span>
        </div>
        
        {/* 플레이어 실루엣/이미지 */}
        <div style={imageWrapperStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/brand/tal-icon-blue.png" 
            alt={playerName} 
            style={{ ...imgStyle, ...(!unlocked ? silhouetteStyle : {}) }} 
          />
        </div>

        <div style={playerNameStyle}>{playerName}</div>
      </div>

      {/* 조각 획득 진행바 */}
      <div style={progressAreaStyle}>
        <div style={labelRowStyle}>
          <span>카드 조각 수집</span>
          <span>{pieceCount}/{totalPieces} ({percentage}%)</span>
        </div>
        <div style={barBgStyle}>
          <div style={{ ...barFillStyle, width: `${percentage}%` }} />
        </div>
        {unlocked && (
          <div style={unlockedTagStyle}>🔓 해금 완료</div>
        )}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
};

const cardFrameStyle: React.CSSProperties = {
  width: '140px',
  height: '200px',
  borderRadius: '16px',
  border: '2px solid rgba(255, 255, 255, 0.1)',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
  transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
};

const lockedCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  opacity: 0.7,
};

const unlockedCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', // Gold card gradient
  border: '2px solid #fbbf24',
  boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3), 0 0 15px rgba(245, 158, 11, 0.1)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  lineHeight: 1.1,
};

const ovrStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 900,
  color: 'white',
};

const posStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'rgba(255, 255, 255, 0.8)',
};

const imageWrapperStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '8px 0',
};

const imgStyle: React.CSSProperties = {
  height: '80px',
  objectFit: 'contain',
  transition: 'all 0.3s',
};

const silhouetteStyle: React.CSSProperties = {
  filter: 'brightness(0) contrast(1.2) opacity(0.6)',
};

const playerNameStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 800,
  fontSize: '0.9rem',
  color: 'white',
  letterSpacing: '-0.5px',
};

const progressAreaStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '220px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.75rem',
  color: '#94a3b8',
  fontWeight: 600,
};

const barBgStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  background: 'rgba(255, 255, 255, 0.08)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const barFillStyle: React.CSSProperties = {
  height: '100%',
  background: '#f59e0b',
  borderRadius: '3px',
  transition: 'width 0.4s ease-out',
};

const unlockedTagStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#f59e0b',
  fontWeight: 800,
  marginTop: '2px',
  textAlign: 'center',
};
