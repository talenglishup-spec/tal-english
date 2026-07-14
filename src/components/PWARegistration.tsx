'use client';

import { useEffect, useState } from 'react';

/**
 * PWARegistration
 *  - 서비스워커 등록
 *  - 커스텀 설치 배너: 최신 Chrome은 자동 설치 배너를 띄우지 않으므로
 *    beforeinstallprompt를 직접 받아 우리 배너 + [설치] 버튼을 보여준다.
 *    iOS Safari는 프로그램 설치가 불가능 → "공유 → 홈 화면에 추가" 안내.
 */
export default function PWARegistration() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1) 서비스워커 등록
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] SW registration failed:', err);
      });

      // 푸시 오픈 추적 ①: 앱이 이미 떠 있을 때 알림 클릭 → SW가 postMessage
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_OPENED' && event.data?.nid) {
          fetch('/api/push/opened', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nid: event.data.nid }),
          }).catch(() => {});
        }
      });
    }

    // 푸시 오픈 추적 ②: 닫힌 상태에서 알림 클릭 → ?from=push&nid= 로 진입
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('from') === 'push' && params.get('nid')) {
        fetch('/api/push/opened', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nid: params.get('nid') }),
        }).catch(() => {});
      }
    } catch (e) {}

    // 2) 이미 설치(standalone)면 배너 불필요
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    // 사용자가 닫았으면 다시 띄우지 않음
    if (localStorage.getItem('tal_install_dismissed') === '1') return;

    // 3) iOS Safari — beforeinstallprompt 미지원 → 수동 안내 배너
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const iosSafari = ios && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    if (iosSafari) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // 4) Android/Chrome 등 — 설치 가능 시점에 배너 표시
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch (_) {}
    setShow(false);
    setDeferred(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('tal_install_dismissed', '1');
  };

  if (!show) return null;

  return (
    <div style={bannerStyle} role="dialog" aria-label="앱 설치 안내">
      <img src="/brand/tal-app-192.png" alt="TAL" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0A228F' }}>TAL 앱 설치</div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.35, marginTop: 2 }}>
          {isIOS
            ? '하단 공유 버튼 → "홈 화면에 추가"'
            : '홈 화면에 추가하고 앱처럼 전체화면으로 쓰세요'}
        </div>
      </div>
      {!isIOS && (
        <button type="button" onClick={handleInstall} style={installBtnStyle}>
          설치
        </button>
      )}
      <button type="button" onClick={handleDismiss} aria-label="닫기" style={closeBtnStyle}>
        ✕
      </button>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: '#ffffff',
  border: '1px solid rgba(10,34,143,0.15)',
  borderRadius: 16,
  boxShadow: '0 12px 32px rgba(10,34,143,0.18)',
  maxWidth: 460,
  margin: '0 auto',
};

const installBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  border: 'none',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
  padding: '9px 16px',
  borderRadius: 12,
  cursor: 'pointer',
};

const closeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  fontSize: 15,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 4,
};
