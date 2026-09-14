-- 015: 회원가입 트리거 회귀 수정 (player_status·player_collection 누락)
--
-- 발견 경로: 새 계정으로 온보딩을 직접 확인하던 중 마이 탭이 이름·이메일·
-- 아바타 없이 "풋볼러 / 무료 플랜"만 보였다. profiles 행은 정확했다
-- (display_name = 'Roi Sangha Lee' 등 실제 값이 들어가 있었다) — 화면 버그가
-- 아니라 player_dashboard 뷰가 아예 빈 결과를 냈다.
--
-- 원인: 001(20260628)의 handle_new_user()는 가입 시 profiles + player_status
-- + player_collection(손흥민 카드 시드) 셋을 모두 만들었다. 그런데
-- 008(20260715, 이메일 미동의 대응)이 CREATE OR REPLACE FUNCTION으로 함수
-- 전체를 갈아치우면서 profiles 하나만 남기고 나머지 둘을 실수로 빠뜨렸다.
-- 그 이후 가입한 계정은 player_status가 아예 생성되지 않는다.
--
-- player_dashboard 뷰가 INNER JOIN(profiles JOIN player_status)이라, 이
-- 계정들은 뷰 조회 결과가 통째로 없어져 마이 탭이 완전히 빈 프로필로 보였다.
-- 002/003의 "방어용 자동 생성"(첫 스픽 통과·첫 데일리 완료 시 없으면 생성)은
-- 그 활동을 한 번도 안 한 신규 유저에겐 발동하지 않는다 — 가입 직후 마이 탭을
-- 여는 게 사실상 항상 먼저다.
--
-- 실측(서비스 롤로 직접 대조, 2026-09-14): 전체 profiles 6건 중 3건이
-- player_status 없음 — 가장 오래된 영향 계정은 2026-07-14 가입.
--
-- 조치:
--   ① handle_new_user()를 001의 3단계로 복원. 008의 안전장치(어떤 단계가
--      실패해도 회원가입 자체는 막지 않음)는 유지 — 이번엔 단계별로 개별
--      예외처리한다(하나가 죽어도 나머지는 계속 시도).
--   ② ensure_profile()도 같은 3단계로 확장 — 트리거를 다시 못 믿을 경우의
--      이중 방어(로그인 시점 자가 치유), 001에도 008에도 없던 부분이다.
--   ③ player_dashboard를 LEFT JOIN으로 변경 — player_status가 어떤 이유로든
--      또 비어도, 최소한 이름·이메일·아바타는 마이 탭에 뜨게 한다. 클라이언트
--      (ShortsExperience.tsx)는 이미 stats 필드마다 ?? 0 / || 'free' 등으로
--      방어하고 있었다 — 뷰의 INNER JOIN만 그 방어를 무력화하고 있었다.
--   ④ 지금 이미 영향받은 계정을 즉시 백필(멱등 — 있으면 손대지 않음).
--
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣고 Run

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
        RAISE WARNING 'handle_new_user: profiles insert failed for %: %', NEW.id, SQLERRM;
    END;

    BEGIN
        INSERT INTO public.player_status (player_id)
        VALUES (NEW.id)
        ON CONFLICT (player_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: player_status insert failed for %: %', NEW.id, SQLERRM;
    END;

    BEGIN
        INSERT INTO public.player_collection (player_id, card_id)
        VALUES (NEW.id, 'SONNY')
        ON CONFLICT (player_id, card_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: player_collection insert failed for %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 로그인 시점 자가 치유 — 트리거가 이번처럼 또 어딘가 빠지더라도 앱 진입 시
-- 스스로 메꾼다. 001·008 어느 쪽에도 player_status/player_collection 백필은
-- 없었다.
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

    INSERT INTO public.player_status (player_id)
    VALUES (auth.uid())
    ON CONFLICT (player_id) DO NOTHING;

    INSERT INTO public.player_collection (player_id, card_id)
    VALUES (auth.uid(), 'SONNY')
    ON CONFLICT (player_id, card_id) DO NOTHING;
END;
$$;

-- player_dashboard: INNER JOIN → LEFT JOIN. player_status가 없어도 최소한
-- 이름·이메일·아바타·구독 정보는 뜬다(전부 profiles 쪽 컬럼).
CREATE OR REPLACE VIEW public.player_dashboard AS
SELECT
    pr.id AS player_id,
    pr.email,
    pr.display_name,
    pr.avatar_url,
    pr.subscription_status,
    pr.subscription_plan,
    pr.subscription_until,
    ps.xp,
    ps.xp_to_next,
    ps.level,
    ps.streak_days,
    ps.streak_week,
    ps.last_active_date,
    ps.updated_at
FROM public.profiles pr
LEFT JOIN public.player_status ps ON ps.player_id = pr.id;

GRANT SELECT ON public.player_dashboard TO authenticated;

-- 이미 영향받은 계정 즉시 백필 (멱등 — 있으면 아무 일도 안 함)
INSERT INTO public.player_status (player_id)
SELECT id FROM public.profiles
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO public.player_collection (player_id, card_id)
SELECT id, 'SONNY' FROM public.profiles
ON CONFLICT (player_id, card_id) DO NOTHING;
