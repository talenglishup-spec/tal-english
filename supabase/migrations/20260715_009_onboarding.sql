-- ============================================================
-- TAL Migration 009: 온보딩 완료 플래그
-- Path: supabase/migrations/20260715_009_onboarding.sql
--
-- 가입 직후 온보딩(홈화면 추가 안내 + 알림 설정)을 거쳤는지 표시.
-- NULL = 미완료 → 앱 진입 시 /onboarding으로 유도.
--
-- 코호트 분석은 별도 컬럼 없이 도출:
--   onboarded_at IS NOT NULL AND notify_opt_in = false → '알림 거부'(대조군)
--   notify_hour_updated_at IS NOT NULL                 → '직접 시간 설정'
--   그 외 opt_in                                        → '기본 시간 수용'
--
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣고 Run
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
