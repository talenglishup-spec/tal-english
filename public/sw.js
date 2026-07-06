// TAL Service Worker — minimal shell
// 목적: Android Chrome "홈 화면에 추가" 설치 배너 조건 충족 + 기본 오프라인 대응

const CACHE_NAME = 'tal-v2';

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
