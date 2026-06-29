'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Check,
  Mic,
  Languages,
  Globe,
  Menu,
  X,
} from 'lucide-react';
import styles from './home.module.css';

/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.navWrap}>
      <nav className={styles.nav}>
        {/* Logo — TAL blue icon PNG */}
        <Link href="/" className={styles.navLogo} aria-label="TAL home">
          <Image
            src="/brand/tal-icon-blue.png"
            alt="TAL"
            width={36}
            height={36}
            className={styles.navLogoImg}
            priority
          />
        </Link>

        {/* Center links — hidden on mobile */}
        <div className={styles.navLinks}>
          <a href="#program">프로그램</a>
          <a href="#players">선수용</a>
          <a href="#clubs">클럽용</a>
          <a href="#method">학습법</a>
          <a href="#pricing">요금제</a>
        </div>

        {/* Right actions */}
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navSignIn}>로그인</Link>
          <Link href="/register" className={styles.btnPrimarySm}>
            시작하기 <ArrowRight size={14} />
          </Link>
          <button
            className={styles.hamburger}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {open && (
        <div className={styles.mobileSheet}>
          <a href="#program" onClick={() => setOpen(false)}>Program</a>
          <a href="#players" onClick={() => setOpen(false)}>For players</a>
          <a href="#clubs" onClick={() => setOpen(false)}>For clubs</a>
          <a href="#method" onClick={() => setOpen(false)}>Method</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          {/* Left — text */}
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>해외 무대를 위한 영어</p>

            <h1 className={styles.heroH1}>
              두 언어로&nbsp;이끌어라.
            </h1>

            <p className={styles.heroKorean}>
              피치 위 언어 그대로.{' '}
              <span className={styles.heroBrand}>TAL.</span>
            </p>

            <p className={styles.heroSub}>
              축구 중심으로 만든 하루 5분 영어 훈련.{'\n'}
              기자 회견, 팀 미팅, 계약 협상까지.{'\n'}
              TAL이 그 순간을 함께 준비합니다.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/register" className={styles.btnPrimaryLg}>
                무료로 시작하기 <ArrowRight size={18} />
              </Link>
              <Link href="#clubs" className={styles.btnSecondaryLg}>
                클럽 문의
              </Link>
            </div>

            <div className={styles.trustRow}>
              <span className={styles.trustItem}>
                <Check size={14} strokeWidth={2.5} /> 프로와 함께 개발
              </span>
              <span className={styles.trustItem}>
                <Check size={14} strokeWidth={2.5} /> 하루 5분
              </span>
            </div>
          </div>

          {/* Right — TAL blue icon PNG tile */}
          <div className={styles.heroImageWrap}>
            <div className={styles.heroTile}>
              <Image
                src="/brand/tal-icon-blue.png"
                alt="TAL logo"
                width={320}
                height={320}
                className={styles.heroTileImg}
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURE ROW
───────────────────────────────────────────── */
const features = [
  {
    icon: <Mic size={24} />,
    title: '마이크 앞에서도 자신있게',
    body: '기자 회견, 경기 후 인터뷰, SNS 영상. 세상에 나가는 그 순간을 미리 연습합니다.',
  },
  {
    icon: <Languages size={24} />,
    title: '피치 위 실제 영어',
    body: '감독과 동료가 실제로 쓰는 말. 전술 지시부터 라커룸 대화까지.',
  },
  {
    icon: <Globe size={24} />,
    title: '축구로 만든 영어',
    body: '모든 훈련이 실제 상황과 연결됩니다. 입단, 훈련, 경기일, 이적 시장.',
  },
];

function FeatureRow() {
  return (
    <section className={styles.featureSection} id="program">
      <div className={styles.container}>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <article key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STAT BLOCK
───────────────────────────────────────────── */
const stats = [
  { value: '5분',  label: '매일 훈련' },
  { value: '34',   label: '축구 상황' },
  { value: '12',   label: '파트너 클럽' },
  { value: '4.9',  label: '앱 평점' },
];

function StatBlock() {
  return (
    <section className={styles.statSection} id="method">
      <div className={styles.statContainer}>
        {/* Top row */}
        <div className={styles.statTop}>
          <div className={styles.statLeft}>
            <p className={styles.statEyebrow}>학습 방법</p>
            <h2 className={styles.statHeadline}>
              <span>귀가 열리고</span>
              <span>입이 열리고</span>
              <span>자신감이 열린다.</span>
            </h2>
            <p className={styles.statSub}>
              아카데미부터 기자 회견장까지, 영어로.
            </p>
          </div>
          <div className={styles.statRight}>
            <Link href="#program" className={styles.btnOnDarkLg}>
              학습법 알아보기 <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Stat row */}
        <div className={styles.statGrid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statItem}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   DRILLS SHOWCASE
───────────────────────────────────────────── */
const drills = [
  {
    title: '경기 후 인터뷰',
    chip: '5분 · 스피킹',
    sub: '"오늘 경기 어떠셨나요?"',
    from: '#2A40A5',
    mid: '#0A228F',
    to: '#06155C',
  },
  {
    title: '프리시즌 합류',
    chip: '8분 · 리스닝',
    sub: '새 클럽, 첫 라커룸.',
    from: '#1F3AA8',
    mid: '#06155C',
    to: '#030A33',
  },
  {
    title: '계약 체결',
    chip: '12분 · 어휘',
    sub: '보너스, 조항, 위약금.',
    from: '#3A52C6',
    mid: '#0A228F',
    to: '#030A33',
  },
  {
    title: '감독과 1대1',
    chip: '10분 · 대화',
    sub: '인사 말고 전술 얘기.',
    from: '#06155C',
    mid: '#030A33',
    to: '#020621',
  },
];

function DrillsShowcase() {
  return (
    <section className={styles.drillsSection}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.drillsHeader}>
          <div>
            <p className={styles.eyebrowNeutral}>훈련 드릴</p>
            <h2 className={styles.drillsH2}>
              중요한 순간을 위한 훈련.
            </h2>
          </div>
          <a href="#program" className={styles.drillsSeeAll}>
            전체 34개 보기 <ArrowRight size={14} />
          </a>
        </div>

        {/* Grid */}
        <div className={styles.drillsGrid}>
          {drills.map((d) => (
            <article
              key={d.title}
              className={styles.drillCard}
              style={{
                background: `linear-gradient(160deg, ${d.from} 0%, ${d.mid} 50%, ${d.to} 100%)`,
              }}
            >
              <div className={styles.drillOverlay} />
              <div className={styles.drillChip}>{d.chip}</div>
              <div className={styles.drillBottom}>
                <h3 className={styles.drillTitle}>{d.title}</h3>
                <p className={styles.drillSub}>{d.sub}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
const footerCols = [
  {
    heading: '프로그램',
    links: ['학습법', '매일 훈련', '표현집', '라이브 코칭', '요금제'],
  },
  {
    heading: '대상',
    links: ['선수용', '클럽용', '에이전트용', '아카데미용'],
  },
  {
    heading: '회사',
    links: ['소개', '채용', '언론', '문의'],
  },
  {
    heading: '법적 고지',
    links: ['개인정보처리방침', '이용약관', '쿠키'],
  },
];

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        {/* Top row */}
        <div className={styles.footerTop}>
          {/* Brand block — white icon on dark bg */}
          <div className={styles.footerBrand}>
            <div className={styles.footerLockup}>
              <Image
                src="/brand/tal-icon-white.png"
                alt="TAL"
                width={48}
                height={48}
                className={styles.footerLogoImg}
              />
              <span className={styles.footerWordmark}>TAL</span>
            </div>
            <p className={styles.footerTagline}>
              선수를 위한 영어 교육. 하루 5분.
              중요한 순간을 위해 훈련합니다.
            </p>
          </div>

          {/* Link grid */}
          <div className={styles.footerLinkGrid}>
            {footerCols.map((col) => (
              <div key={col.heading} className={styles.footerCol}>
                <p className={styles.footerColHeading}>{col.heading}</p>
                {col.links.map((l) => (
                  <a key={l} href="#" className={styles.footerLink}>{l}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className={styles.footerBottom}>
          <span className={styles.footerCopy}>
            &copy; 2026 TAL. 해외 무대를 위해.
          </span>
          <span className={styles.footerLocale}>
            <Globe size={14} /> 한국어 · English
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FeatureRow />
        <StatBlock />
        <DrillsShowcase />
      </main>
      <Footer />
    </>
  );
}
