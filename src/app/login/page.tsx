'use client';

import React, { useState } from 'react';
import { getSupabase } from '@/utils/supabase';
import styles from '../LoginPage.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKakaoLogin = () => {
    // 백엔드 카카오 OAuth 리다이렉션 라우트 실행
    window.location.href = '/api/auth/kakao/login';
  };

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

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandSection}>
          <p className={styles.appLabel}>Take A Leap</p>
          <h2 className={styles.mission}>TAL</h2>
          <p className={styles.subtext}>피치 위 언어 그대로, 선수들의 영어 훈련소</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* 카카오 1탭 로그인 최상단 배치 */}
        <button 
          type="button" 
          onClick={handleKakaoLogin} 
          className={styles.kakaoBtn}
        >
          <span>💬</span> 카카오로 시작하기
        </button>

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

          <button 
            type="submit" 
            disabled={loading} 
            className={styles.submitBtn}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
