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
  source?: 'organic' | 'push' | 'share';
};

/** 클립 시청 1건 — 쇼츠에서 클립이 비활성화될 때(스크롤 이동) 1건 쌓인다 */
type ClipView = {
  clip_id: string;
  dwell_ms: number;
  speak_triggered: boolean;   // 🎙️ Speak를 눌러 발화 모드에 진입했는가
  speak_completed: boolean;   // 녹음까지 마쳐 채점을 받았는가
};

let buffer: TrackEvent[] = [];
let clipBuffer: ClipView[] = [];
let flushTimer: any = null;
let sessionSource: 'organic' | 'push' | 'share' = 'organic';
let currentTab: string | null = null;
let lastTab = 'home'; // 백그라운드 복귀 시 체류 재개용
let tabEnteredAt = 0;
let initialized = false;

export function setSessionSource(source: 'organic' | 'push' | 'share') {
  sessionSource = source;
}

export function trackEvent(e: TrackEvent) {
  buffer.push({ source: sessionSource, ...e });
  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(false), 8000); // 8초 배칭
  }
}

/**
 * 클립 시청 1건 기록 — 쇼츠에서 클립이 비활성화되는 순간(다음 클립으로 이동,
 * 탭 이탈, 앱 종료) 호출한다. 즉시 전송하지 않고 버퍼에 쌓아 활동 이벤트와
 * 함께 배치로 보낸다(재생 중 네트워크가 튀지 않게).
 * 0.5초 미만 스침은 스크롤 통과로 보고 버린다.
 */
export function trackClipView(v: ClipView) {
  if (!v.clip_id || v.dwell_ms < 500) return;
  clipBuffer.push(v);
  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(false), 8000);
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
  if (buffer.length === 0 && clipBuffer.length === 0) return;
  const payload = JSON.stringify({
    events: buffer.splice(0, buffer.length),
    clipViews: clipBuffer.splice(0, clipBuffer.length),
  });

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
export function initSessionTracking(initialTab: string, source: 'organic' | 'push' | 'share') {
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
