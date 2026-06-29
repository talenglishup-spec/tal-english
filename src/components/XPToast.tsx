'use client';

import React, { useEffect, useState } from 'react';

interface XPToastProps {
  xp: number;
  visible: boolean;
  onClose: () => void;
}

export default function XPToast({ xp, visible, onClose }: XPToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const t = setTimeout(() => {
        setShow(false);
        onClose();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [visible, onClose]);

  if (!show) return null;

  return (
    <div style={containerStyle}>
      <div style={toastStyle}>
        <span style={flashStyle}>⚡</span>
        <span style={textStyle}>+{xp} XP</span>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 9999,
  pointerEvents: 'none',
  animation: 'floatUp 1.5s ease-out forwards',
};

const toastStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  padding: '16px 28px',
  borderRadius: '24px',
  color: 'white',
  fontWeight: 900,
  fontSize: '1.8rem',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.2)',
  border: '2px solid rgba(255, 255, 255, 0.2)',
};

const flashStyle: React.CSSProperties = {
  fontSize: '2rem',
  animation: 'pulse 0.5s infinite alternate',
};

const textStyle: React.CSSProperties = {
  letterSpacing: '-1px',
};
