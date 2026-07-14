-- ============================================================
-- TAL Migration 008: 프로필 생성 근본 방어 (이메일 미동의 회원가입 대응)
-- Path: supabase/migrations/20260715_008_profile_self_heal.sql
--
-- 배경: profiles.email은 NOT NULL인데, 카카오 로그인에서 이메일이 선택
-- 동의 항목이 되면서 사용자가 거부하면 auth.users.email이 NULL로 들어올
-- 수 있다. 기존 handle_new_user() 트리거는 NEW.email을 그대로 넣었으므로
-- NOT NULL 위반 → 트리거가 예외를 던짐 → AFTER INSERT 트리거는 auth.users
-- INSERT와 같은 트랜잭션이라 회원가입 전체가 롤백된다(계정 생성 자체가 실패).
--
-- 조치:
--   ① handle_new_user(): 이메일 없으면 안전한 대체값 사용 + 프로필 생성 중
--      어떤 예외가 나도 트리거 자체는 절대 실패시키지 않음(회원가입은 항상 성공)
--   ② ensure_profile(): 로그인 시 클라이언트가 호출하는 자체 복구 RPC.
--      트리거가 어떤 이유로든(과거처럼 미적용 상태였거나, 향후 다른 이유로)
--      프로필을 못 만든 계정을 로그인 시점에 채운다 — 트리거 하나에만
--      의존하지 않는 이중 방어.
--
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣고 Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, email, display_name, avatar_url)
        VALUES (
            NEW.id,
            -- 이메일 미동의(NULL) 시에도 NOT NULL을 만족하는 결정적 대체값
            COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@no-email.tal.local'),
            COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                '풋볼러'
            ),
            NEW.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- 프로필 생성이 어떤 이유로든 실패해도 회원가입(auth.users insert)
        -- 자체는 절대 막지 않는다. 누락된 프로필은 ensure_profile()이 채운다.
        RAISE WARNING 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 로그인 시 클라이언트가 호출 — 본인 프로필이 없으면 생성(있으면 아무 일도 안 함)
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    SELECT
        au.id,
        COALESCE(NULLIF(au.email, ''), au.id::text || '@no-email.tal.local'),
        COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '풋볼러'),
        au.raw_user_meta_data->>'avatar_url'
    FROM auth.users au
    WHERE au.id = auth.uid()
    ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
