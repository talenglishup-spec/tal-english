import type { Metadata } from 'next';
import React from 'react';

/**
 * 공유 링크 미리보기(카카오톡·문자·SNS)에 그대로 나오는 값들이다.
 * 앱에서 "앱 공유하기"를 누르면 이 페이지 주소가 나가므로, 브랜드 표기는
 * TAL / Take A Leap 로만 통일한다.
 */
export const metadata: Metadata = {
  title: 'TAL — Take A Leap',
  description:
    '축구 선수들이 실제 축구 상황에서 쓰는 영어를 배워 해외 무대로 도약하도록 돕는 영어 교육 프로그램.',
  themeColor: '#0A228F',
  openGraph: {
    title: 'TAL — Take A Leap',
    description: '피치 위 언어 그대로. TAL.',
    type: 'website',
    // url·locale을 고정하지 않는다 — 예전엔 소유하지 않은 tal.com이 og:url로
    // 나가 크롤러가 그쪽을 정본으로 삼을 수 있었다. 비워두면 실제 배포 주소가 쓰인다.
    locale: 'ko_KR',
    // tal-og.png는 저장소에 없어 미리보기 이미지가 깨져 있었다. 전용
    // 1200x630 이미지가 준비되기 전까지 실제 존재하는 앱 아이콘을 쓴다.
    images: [{ url: '/brand/tal-app-512.png', width: 512, height: 512, alt: 'TAL' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Google Fonts — TAL design system */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600;700;900&family=Manrope:wght@400;500;600;700;800&family=Black+Han+Sans&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      {/* Favicon & app icons */}
      <link rel="icon" href="/brand/tal-app-32.png" sizes="32x32" type="image/png" />
      <link rel="apple-touch-icon" href="/brand/tal-app-180.png" />
      <link rel="preload" as="image" href="/brand/tal-app-192.png" fetchPriority="high" />

      <style>{`
        body {
          font-family: 'Manrope', 'Pretendard', system-ui, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #0A0E1A;
          background: #F7F8FB;
          -webkit-font-smoothing: antialiased;
        }
        h1, h2, h3, h4, h5 {
          font-family: 'Zilla Slab', 'Roboto Slab', serif;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.05;
          text-wrap: balance;
          color: #0A0E1A;
          margin: 0;
        }
        *, *::before, *::after { box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        button { cursor: pointer; border: none; font-family: inherit; background: transparent; }
        img { max-width: 100%; height: auto; }
        p { margin: 0; }
      `}</style>
      {children}
    </>
  );
}
