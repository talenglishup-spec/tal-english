'use client';

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { getSupabase } from '@/utils/supabase';
import styles from '../LoginPage.module.css';

type Mode = 'login' | 'signup';

// 설정돼 있으면 구글 Identity Services(GSI)로 직접 로그인 처리 — 구글 동의
// 화면에 우리 도메인이 뜬다(Supabase 프로젝트 서브도메인 대신, 무료).
// Google Cloud Console에서 이 앱 도메인을 "승인된 JavaScript 출처"로 등록한
// 뒤 이 값을 채워야 한다. 비어 있으면 예전 방식(Supabase 호스팅 리다이렉트,
// 구글 동의 화면에 supabase.co가 뜸)으로 조용히 대체된다 — 등록 전에도
// 로그인 자체는 깨지지 않는다.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function randomNonce(): string {
  // crypto.randomUUID는 Safari 구버전엔 없을 수 있어 getRandomValues로 대체.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // 이번 로그인 시도의 원본(해싱 전) nonce — GSI 콜백에서 signInWithIdToken에
  // 그대로 넘겨야 하므로 state가 아니라 ref로 들고 있는다(리렌더 불필요).
  const googleNonceRef = useRef('');
  // GSI 공식 버튼이 그려질 자리와, 실제로 그려졌는지 여부.
  // 안 그려졌으면(스크립트 차단·클라이언트 ID 미설정 등) 우리 버튼을 대신
  // 보여주고 예전 리다이렉트 방식으로 로그인시킨다.
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gsiReady, setGsiReady] = useState(false);

  // OAuth 콜백에서 넘어온 에러 파라미터 표시
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) setError(decodeURIComponent(urlError));
  }, []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setError(null);
    setSuccess(null);
  };

  const switchMode = (newMode: Mode) => {
    resetForm();
    setMode(newMode);
  };

  const handleKakaoLogin = async () => {
    // 카카오 OAuth는 반드시 브라우저에서 시작해야 한다.
    // getSupabase()는 브라우저에서 createBrowserClient(@supabase/ssr)를 반환하며,
    // 이 클라이언트가 PKCE code_verifier를 "쿠키"에 저장한다. 그래야 콜백
    // 라우트의 exchangeCodeForSession이 그 쿠키를 읽어 세션 교환에 성공한다.
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/api/auth/kakao/callback`,
          // Supabase의 카카오 기본 scope에는 account_email이 포함되는데,
          // 카카오 이메일은 비즈니스 앱 전환이 필요해 대부분 미설정 → KOE205.
          // 콘솔에 설정된 profile_nickname만 명시해 account_email을 제외한다.
          scopes: 'profile_nickname profile_image account_email',
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('카카오 로그인 URL 생성에 실패했습니다.');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Kakao Login] error:', err);
      setError(err.message || '카카오 로그인에 실패했습니다.');
    }
  };

  // 예전 방식 — Supabase 호스팅 리다이렉트. GSI가 아직 준비 안 됐거나(스크립트
  // 로딩 전 클릭 등) 화면에 아무것도 못 띄운 경우의 대체 경로로만 쓴다.
  const legacyGoogleRedirect = async () => {
    try {
      const supabase = getSupabase();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/google/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('Google 로그인 URL 생성에 실패했습니다.');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Google Login] error:', err);
      setError(err.message || 'Google 로그인에 실패했습니다.');
    }
  };

  // GSI가 ID 토큰을 돌려주면 여기서 Supabase 세션으로 교환한다.
  const handleGoogleCredential = async (response: { credential: string }) => {
    // 여기까지 왔다는 건 구글에서 토큰을 실제로 받았다는 뜻이다. 이 다음
    // 실패는 "예전 방식으로 넘기면 될 문제"가 아니라 토큰 교환 자체의
    // 문제라, 리다이렉트로 덮지 않고 실제 에러를 보여준다.
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: idErr } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: googleNonceRef.current,
      });
      if (idErr) throw idErr;
      if (!data.session) throw new Error('세션을 생성하지 못했습니다.');
      window.location.href = '/home';
    } catch (err: any) {
      console.error('[Google GSI Login] error:', err);
      setError(err.message || 'Google 로그인에 실패했습니다.');
    }
  };

  // GSI 공식 버튼을 렌더한다 — 팝업(ux_mode: 'popup') 방식이라 FedCM에
  // 의존하지 않는다.
  //
  // 왜 prompt()(원탭/FedCM)를 버렸나: 프로덕션에서 재현해보니 FedCM이
  // "403 → FedCM get() rejects with NetworkError"로 매번 실패하는데, 그
  // 실패가 notification 콜백을 안 태우고 조용히 멈춰서 버튼이 먹통이 됐다.
  // 타임아웃으로 우회했더니 이번엔 모든 구글 로그인이 3.5초를 버리고 예전
  // 방식으로 떨어졌다. 팝업 방식은 브라우저 저수준 API가 아니라 평범한
  // 팝업 창을 쓰므로 그 계열 실패가 아예 없고, 동의 화면에도 우리 도메인이
  // 뜬다(목적 그대로).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || mode !== 'login') return;
    let cancelled = false;

    const tryRender = async () => {
      const g = (window as any).google;
      const host = googleBtnRef.current;
      if (!g?.accounts?.id || !host || host.childElementCount > 0) return !!host?.childElementCount;

      // nonce: 원본은 signInWithIdToken에, 해시는 구글 initialize에 —
      // Supabase가 원본을 다시 해싱해 ID 토큰의 nonce 클레임과 대조한다.
      const nonce = randomNonce();
      googleNonceRef.current = nonce;
      const hashedNonce = await sha256Hex(nonce);
      if (cancelled) return false;

      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        nonce: hashedNonce,
        ux_mode: 'popup',
      });
      g.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        locale: 'ko',
        width: 300,
      });
      if (!cancelled) setGsiReady(true);
      return true;
    };

    // 스크립트가 언제 로드될지 모르니 잠깐 폴링하다 포기한다(3초).
    let tries = 0;
    const iv = setInterval(async () => {
      if (cancelled || (await tryRender()) || ++tries > 20) clearInterval(iv);
    }, 150);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (!data.user) {
        throw new Error('사용자 세션을 불러올 수 없습니다.');
      }

      // AuthContext용 tal_user 로컬 세션 동기화
      localStorage.setItem('tal_user', JSON.stringify({
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Player',
        role: 'player'
      }));

      // 세션 쿠키 브라우저 갱신 타임 대기용 150ms 후 대시보드로 이동
      setTimeout(() => {
        window.location.href = '/home';
      }, 150);

    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        // 이메일 인증 필요 (Supabase 기본 설정)
        setSuccess('가입 확인 이메일을 보냈습니다. 받은 편지함을 확인해 주세요.');
      } else if (data.session) {
        // 이메일 인증 비활성화 시 즉시 로그인
        window.location.href = '/home';
      }
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* GOOGLE_CLIENT_ID가 없으면 로드해도 아무 효과 없다(그냥 대기) —
          미리 부담 없이 넣어둔다. 등록 후엔 재배포 없이 즉시 작동. */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div className={styles.card}>
        <div className={styles.brandSection}>
          <p className={styles.appLabel}>Take A Leap</p>
          <h2 className={styles.mission}>TAL</h2>
          <p className={styles.subtext}>피치 위 언어 그대로, 선수들의 영어 훈련소</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {mode === 'login' ? (
          <>
            <div className={styles.socialButtons}>
              <button type="button" onClick={handleKakaoLogin} className={styles.kakaoBtn}>
                <span>💬</span> 카카오로 시작하기
              </button>
              {/* 구글 공식 버튼(팝업 방식). 못 그려졌을 때만 우리 버튼 노출 */}
              <div
                ref={googleBtnRef}
                style={{ display: gsiReady ? 'flex' : 'none', justifyContent: 'center' }}
              />
              {!gsiReady && (
                <button type="button" onClick={legacyGoogleRedirect} className={styles.googleBtn}>
                  <GoogleIcon /> Google로 시작하기
                </button>
              )}
            </div>

            <div className={styles.divider}>또는 이메일로 로그인</div>

            <form onSubmit={handleEmailLogin} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="email">이메일 주소</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="password">비밀번호</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className={styles.modeToggle}>
              계정이 없으신가요?{' '}
              <button type="button" onClick={() => switchMode('signup')} className={styles.linkBtn}>
                이메일로 회원가입
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleEmailSignup} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="name">닉네임 <span className={styles.optional}>(선택)</span></label>
                <input
                  id="name"
                  type="text"
                  placeholder="영어 학습자"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="signup-email">이메일 주소</label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="signup-password">비밀번호</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="confirm-password">비밀번호 확인</label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? '처리 중...' : '회원가입'}
              </button>
            </form>

            <div className={styles.modeToggle}>
              이미 계정이 있으신가요?{' '}
              <button type="button" onClick={() => switchMode('login')} className={styles.linkBtn}>
                로그인
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
