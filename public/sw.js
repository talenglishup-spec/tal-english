// TAL Service Worker — minimal shell
// 목적: Android Chrome "홈 화면에 추가" 설치 배너 조건 충족 + 기본 오프라인 대응

const CACHE_NAME = 'tal-v3';

// 앱 셸: 로그인 화면이 오프라인에서도 표시되도록 정적 자산 캐싱
const PRECACHE_URLS = ['/login', '/brand/tal-app-192.png', '/brand/tal-app-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 구버전 캐시 정리
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 항상 네트워크 우선 (캐시 안 함)
  if (url.pathname.startsWith('/api/')) return;

  // 탐색 요청(HTML): 네트워크 먼저, 실패 시 캐시
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/login') ?? fetch(request))
    );
    return;
  }

  // 정적 자산: 캐시 우선
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});

// ── 웹푸시 (학습 리마인더) ────────────────────────────────
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || 'TAL English Up', {
      body: d.body || '오늘의 훈련이 기다리고 있어요 ⚽',
      icon: '/brand/tal-app-192.png',
      badge: '/brand/tal-app-192.png',
      tag: 'tal-reminder', // 같은 tag = 알림이 쌓이지 않고 최신으로 대체
      data: { url: d.url || '/home', nid: d.nid || '' },
    })
  );
});

// 클릭 → 오픈 추적: 앱이 이미 떠 있으면(standalone 포함) 새 창을 못 열어
// URL 파라미터가 전달되지 않으므로, 열린 창에는 postMessage로 nid를 전달하고
// 닫혀 있을 때만 ?from=push&nid= 로 연다. 두 경로 모두 커버해야 오픈율이
// 과소 집계되지 않는다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/home';
  const nid = data.nid || '';

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const opened = wins.find((w) => w.url.startsWith(self.location.origin));
    if (opened) {
      try { await opened.focus(); } catch (e) {}
      opened.postMessage({ type: 'PUSH_OPENED', nid });
    } else {
      await self.clients.openWindow(
        url + (url.includes('?') ? '&' : '?') + 'from=push&nid=' + encodeURIComponent(nid)
      );
    }
  })());
});
