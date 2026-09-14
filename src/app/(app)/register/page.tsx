'use client';

/**
 * /register — 폐기됨. 미들웨어가 이 경로를 전부 '/'로 되돌리므로 정상 배포에서는
 * 이 컴포넌트가 렌더될 일이 없다. 이 파일은 방어선 2단계일 뿐이다 — 미들웨어가
 * 비활성화된 로컬 개발 환경이나 향후 리팩터로 그 규칙이 사라져도, 예전처럼
 * "가입은 되는데 로그인할 수단이 없는" 막다른 골목으로는 다시 빠지지 않는다.
 *
 * 예전 동작: 구글시트에 player_id/password를 발급했지만, 그 자격증명으로 로그인할
 * 방법이 /login(카카오·구글·이메일)에 없었다. 실제 가입·로그인은 /login이 맡는다.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
