-- ============================================================
-- TAL Migration 007: 웹푸시 알림 + 학습 활동 추적 (체험단 데이터 수집)
-- Path: supabase/migrations/20260714_007_webpush_activity.sql
--
-- 구성:
--   ① push_subscriptions — 기기별 웹푸시 구독 (1 유저 : N 기기)
--   ② profiles 알림 설정 컬럼 (opt-in 기본 false, 커스텀 시간)
--   ③ notification_log — 발송/오픈 추적 (study_within_1h 등 파생값은
--      컬럼 저장 없이 분석 시 speak_attempts_log와 조인으로 도출)
--   ④ activity_log — 학습 시간대·요일별 체류시간·지속율 추적 (append-only)
--   ⑤ pg_cron + pg_net — 매시간 발송 트리거 (Vercel Hobby 크론 제한 우회)
--
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣고 Run
--       ⑤의 <YOUR_...> 플레이스홀더 2곳을 실제 값으로 교체 후 실행!
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ① push_subscriptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint     TEXT NOT NULL UNIQUE,   -- 브라우저 발급, 기기·브라우저별 고유
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,
    active       BOOLEAN NOT NULL DEFAULT TRUE,  -- 410/404 응답 시 false 처리
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subs_player_idx
    ON public.push_subscriptions(player_id) WHERE active;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs: own select" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "push_subs: own insert" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "push_subs: own update" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);
CREATE POLICY "push_subs: own delete" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────
-- ② profiles 알림 설정
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS notify_opt_in BOOLEAN NOT NULL DEFAULT FALSE, -- 명시적 동의 필수
    ADD COLUMN IF NOT EXISTS notify_hour INTEGER,                          -- 0~23 KST, NULL = 기본 20시
    ADD COLUMN IF NOT EXISTS notify_hour_updated_at TIMESTAMPTZ;           -- 유저가 직접 설정했는지(코호트 구분)

-- ─────────────────────────────────────────────────────────────
-- ③ notification_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    template_code TEXT NOT NULL,             -- 'STREAK_KEEP' | 'COMEBACK'
    cohort        TEXT,                      -- 'custom_time' | 'default_time'
    channel       TEXT NOT NULL DEFAULT 'webpush',
    sent_hour_kst INTEGER,                   -- 발송 KST 시각 (시간대 효과 분석)
    delivered     BOOLEAN NOT NULL DEFAULT FALSE, -- 1개 이상 구독에 발송 성공
    opened_at     TIMESTAMPTZ                -- 알림 클릭 → 앱 진입 시각
);

CREATE INDEX IF NOT EXISTS notif_log_player_idx
    ON public.notification_log(player_id, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- 발송은 service_role(크론)이 수행하므로 INSERT 정책은 만들지 않는다.
-- 유저는 자기 알림의 조회 + opened_at 기록만 가능.
CREATE POLICY "notif_log: own select" ON public.notification_log
    FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "notif_log: own update" ON public.notification_log
    FOR UPDATE USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────
-- ④ activity_log — 학습 시간대 · 요일별 체류시간 · 지속율
--    append-only 이벤트 로그. 세션/체류는 분석 시 SQL로 재구성한다.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event      TEXT NOT NULL,   -- 'session_start' | 'tab_dwell' | 'session_end'
    tab        TEXT,            -- 'home'|'shorts'|'challenge'|'collection'|'my'
    dwell_ms   INTEGER,         -- tab_dwell/session_end 이벤트의 체류시간
    source     TEXT,            -- 'organic' | 'push' (푸시 유입 세션 구분)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_player_time_idx
    ON public.activity_log(player_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity: own select" ON public.activity_log
    FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "activity: own insert" ON public.activity_log
    FOR INSERT WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────
-- ⑤ pg_cron — 매시간 정각에 발송 엔드포인트 호출
--    ⚠️ 실행 전 아래 2곳을 실제 값으로 교체:
--      <YOUR_APP_URL>    예: https://tal-english.vercel.app
--      <YOUR_CRON_SECRET> .env.local의 CRON_SECRET 값
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
    'tal-push-reminder-hourly',
    '0 * * * *',
    $$
    SELECT net.http_get(
        url := '<YOUR_APP_URL>/api/cron/push-reminder',
        headers := jsonb_build_object('Authorization', 'Bearer <YOUR_CRON_SECRET>')
    );
    $$
);

-- (재실행 시 중복 방지: 기존 잡 삭제 후 다시 schedule 하려면)
-- SELECT cron.unschedule('tal-push-reminder-hourly');

-- ─────────────────────────────────────────────────────────────
-- 참고: 분석 쿼리 (저장하지 않고 도출하는 파생 지표)
-- ─────────────────────────────────────────────────────────────
-- ▸ 알림 오픈율 + 1시간 내 학습 전환율 (코호트/발송 시간대별)
-- SELECT n.cohort, n.sent_hour_kst, COUNT(*) AS sent,
--        ROUND(AVG((n.opened_at IS NOT NULL)::int)*100,1) AS open_rate,
--        ROUND(AVG(EXISTS(
--          SELECT 1 FROM speak_attempts_log s
--          WHERE s.player_id=n.player_id
--            AND s.created_at BETWEEN n.sent_at AND n.sent_at+interval '1 hour')::int)*100,1) AS study_rate
-- FROM notification_log n WHERE n.delivered
-- GROUP BY 1,2 ORDER BY study_rate DESC;
--
-- ▸ 학습 시간대 분포 (KST 시간별 활동량)
-- SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Seoul') AS hour_kst,
--        COUNT(DISTINCT player_id) AS users, COUNT(*) AS events
-- FROM activity_log GROUP BY 1 ORDER BY 1;
--
-- ▸ 요일별 체류시간 (탭별)
-- SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Asia/Seoul') AS dow, tab,
--        ROUND(SUM(dwell_ms)/1000.0/60, 1) AS total_min,
--        ROUND(AVG(dwell_ms)/1000.0, 1) AS avg_sec
-- FROM activity_log WHERE event='tab_dwell'
-- GROUP BY 1,2 ORDER BY 1,2;
--
-- ▸ 지속율(리텐션): 가입 후 N일차에 활동한 유저 비율
-- WITH first_day AS (
--   SELECT player_id, MIN((created_at AT TIME ZONE 'Asia/Seoul')::date) AS d0
--   FROM activity_log GROUP BY 1
-- ), daily AS (
--   SELECT DISTINCT a.player_id,
--          ((a.created_at AT TIME ZONE 'Asia/Seoul')::date - f.d0) AS day_n
--   FROM activity_log a JOIN first_day f USING (player_id)
-- )
-- SELECT day_n, COUNT(*) AS active_users,
--        ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM first_day),1) AS retention_pct
-- FROM daily GROUP BY 1 ORDER BY 1;
