import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 빌드 페이지 데이터 수집 워커 수 제한 — 기본(코어 수 15개)으로 병렬
    // 실행 시 로컬 메모리 부족(OOM)으로 워커가 죽는 문제 방지.
    cpus: 4,
  },
};

export default nextConfig;
