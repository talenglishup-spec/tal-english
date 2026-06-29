-- ============================================================
-- TAL Migration: Add Subscription Columns to Profiles & Dashboard
-- Path: supabase/migrations/20260629_004_add_subscription_columns.sql
-- ============================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMPTZ;

-- player_dashboard 뷰 갱신 (구독 컬럼 노출 추가)
CREATE OR REPLACE VIEW public.player_dashboard AS
SELECT
    ps.player_id,
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
FROM public.player_status ps
JOIN public.profiles pr ON pr.id = ps.player_id;

-- Grant usage to authenticated role
GRANT SELECT ON public.player_dashboard TO authenticated;
