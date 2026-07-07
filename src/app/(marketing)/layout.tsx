import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'TAL — Lead in two languages.',
  description:
    'English education built for footballers. Five-minute drills around real moments: press conferences, team talks, contract days.',
  themeColor: '#0A228F',
  openGraph: {
    title: 'TAL — Lead in two languages.',
    description: '피치 위 언어 그대로. TAL.',
    type: 'website',
    url: 'https://tal.com',
    locale: 'en_US',
    images: [{ url: '/brand/tal-og.png', width: 1200, height: 630 }],
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
