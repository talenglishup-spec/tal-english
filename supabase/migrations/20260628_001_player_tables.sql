-- ============================================================
-- TAL Phase 1: Player Tables (Optimized)
-- Migration: 20260628_001_player_tables.sql
-- Rev 2: public.profiles 분리로 auth.users 직접 조인 권한 오류 해결
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. public.profiles (auth.users 정보 동기화용 테이블)
--    - authenticated 역할은 auth.users 직접 접근 불가 (Supabase 보안 정책)
--    - 가입 트리거 시점에 이메일/이름/아바타를 public 스키마로 복사
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- 1. player_status
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.player_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    xp              INTEGER NOT NULL DEFAULT 0,
    xp_to_next      INTEGER NOT NULL DEFAULT 3000,
    level           INTEGER NOT NULL DEFAULT 1,
    streak_days     INTEGER NOT NULL DEFAULT 0,
    streak_week     BOOLEAN[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
    last_active_date DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(player_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER player_status_updated_at
    BEFORE UPDATE ON public.player_status
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. player_collection
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.player_collection (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id         TEXT NOT NULL,          -- e.g. 'SONNY', 'HAALAND', 'PEP'
    piece_count     INTEGER NOT NULL DEFAULT 0,
    total_pieces    INTEGER NOT NULL DEFAULT 30,
    unlocked        BOOLEAN NOT NULL DEFAULT false,
    unlocked_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(player_id, card_id)
);

CREATE OR REPLACE TRIGGER player_collection_updated_at
    BEFORE UPDATE ON public.player_collection
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. speak_attempts_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.speak_attempts_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id           TEXT NOT NULL,
    stt_text          TEXT,
    levenshtein_score INTEGER,              -- 0-100, 내부 계산 전용 (유저 미노출)
    passed            BOOLEAN NOT NULL DEFAULT false,
    audio_url         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speak_attempts_player_idx
    ON public.speak_attempts_log(player_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- RLS: Enable + Policies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.player_status      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_collection  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speak_attempts_log ENABLE ROW LEVEL SECURITY;

-- player_status
CREATE POLICY "player_status: own read"
    ON public.player_status FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "player_status: own insert"
    ON public.player_status FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "player_status: own update"
    ON public.player_status FOR UPDATE
    USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

-- player_collection
CREATE POLICY "player_collection: own read"
    ON public.player_collection FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "player_collection: own insert"
    ON public.player_collection FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "player_collection: own update"
    ON public.player_collection FOR UPDATE
    USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

-- speak_attempts_log
CREATE POLICY "speak_attempts: own read"
    ON public.speak_attempts_log FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "speak_attempts: own insert"
    ON public.speak_attempts_log FOR INSERT WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────
-- DB Trigger: 신규 가입 시 profiles + player_status + collection 자동 생성
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. public.profiles에 유저 정보 복사 (auth.users 직접 조인 대체)
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            '풋볼러'
        ),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. player_status 초기 레코드 생성
    INSERT INTO public.player_status (player_id)
    VALUES (NEW.id)
    ON CONFLICT (player_id) DO NOTHING;

    -- 3. 기본 카드 슬롯 시드 (손흥민)
    INSERT INTO public.player_collection (player_id, card_id)
    VALUES (NEW.id, 'SONNY')
    ON CONFLICT (player_id, card_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Helper view: player_dashboard (public.profiles 조인 — 권한 오류 없음)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.player_dashboard AS
SELECT
    ps.player_id,
    pr.email,
    pr.display_name,
    pr.avatar_url,
    ps.xp,
    ps.xp_to_next,
    ps.level,
    ps.streak_days,
    ps.streak_week,
    ps.last_active_date,
    ps.updated_at
FROM public.player_status ps
JOIN public.profiles pr ON pr.id = ps.player_id;

GRANT SELECT ON public.player_dashboard TO authenticated;
