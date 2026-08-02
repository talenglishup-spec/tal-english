import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 빌드 페이지 데이터 수집 워커 수 제한 — 기본(코어 수 15개)으로 병렬
    // 실행 시 로컬 메모리 부족(OOM)으로 워커가 죽는 문제 방지.
    cpus: 4,
  },
  async headers() {
    return [
      {
        // 폰트는 내용이 바뀌면 파일명을 바꾼다는 전제로 영구 캐시한다.
        // 한글 웹폰트는 두 굵기 합쳐 약 1MB라, 방문할 때마다 다시 받으면
        // 매번 첫 화면이 늦어진다. 재검증 없이 캐시에서 바로 쓰게 한다.
        source: '/fonts/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
