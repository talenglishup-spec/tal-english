'use client';

/**
 * 학습 활동 추적 — 학습 시간대 · 요일별 체류시간 · 지속율 데이터 수집
 *
 * 설계 원칙:
 *  - append-only 이벤트를 클라이언트 버퍼에 쌓고 주기적으로 flush
 *  - 앱 이탈(백그라운드 전환/닫기) 시 navigator.sendBeacon으로 잔여분 전송
 *    → visibilitychange(hidden) + pagehide 이중 커버. beforeunload는 모바일
 *      Safari에서 신뢰 불가라 쓰지 않는다. 이걸 안 하면 "마지막으로 보던 탭"
 *      체류시간이 체계적으로 유실된다.
 *  - 추적 실패는 조용히 무시 — 학습 흐름을 절대 방해하지 않는다.
 */

type TrackEvent = {
  event: 'session_start' | 'tab_dwell' | 'session_end';
  tab?: string;
  dwell_ms?: number;
  source?: 'organic' | 'push';
};

let buffer: TrackEvent[] = [];
let flushTimer: any = null;
let sessionSource: 'organic' | 'push' = 'organic';
let currentTab: string | null = null;
let lastTab = 'home'; // 백그라운드 복귀 시 체류 재개용
let tabEnteredAt = 0;
let initialized = false;

export function setSessionSource(source: 'organic' | 'push') {
  sessionSource = source;
}

export function trackEvent(e: TrackEvent) {
  buffer.push({ source: sessionSource, ...e });
  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(false), 8000); // 8초 배칭
  }
}

/** 탭 진입 — 이전 탭의 체류시간을 마감하고 새 탭 타이머 시작 */
export function trackTabEnter(tab: string) {
  closeDwell();
  currentTab = tab;
  lastTab = tab;
  tabEnteredAt = Date.now();
}

function closeDwell() {
  if (currentTab && tabEnteredAt > 0) {
    const dwell = Date.now() - tabEnteredAt;
    if (dwell >= 500) { // 0.5초 미만 스침은 노이즈
      buffer.push({ event: 'tab_dwell', tab: currentTab, dwell_ms: dwell, source: sessionSource });
    }
  }
  currentTab = null;
  tabEnteredAt = 0;
}

function flush(useBeacon: boolean) {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (buffer.length === 0) return;
  const payload = JSON.stringify({ events: buffer.splice(0, buffer.length) });

  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {}
}

/** 세션 추적 시작 — 앱 마운트 시 1회 호출 */
export function initSessionTracking(initialTab: string, source: 'organic' | 'push') {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  sessionSource = source;

  trackEvent({ event: 'session_start' });
  trackTabEnter(initialTab);

  const onLeave = () => {
    closeDwell();
    buffer.push({ event: 'session_end', source: sessionSource });
    flush(true); // 이탈 시엔 반드시 Beacon
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      onLeave();
    } else {
      // 백그라운드 복귀 — 새 세션 시작으로 기록하고 직전 탭 체류 재개
      trackEvent({ event: 'session_start' });
      trackTabEnter(lastTab);
    }
  });
  window.addEventListener('pagehide', onLeave);
}
