-- ============================================================
-- TAL Migration 006: 챌린지 XP 체계 (MVP 중고등)
-- Path: supabase/migrations/20260712_006_challenge_xp.sql
--
-- XP 정책:
--   표현 첫 정답(first_pass)      +15
--   세션 완료(session_complete)   +10  (KST 1일 1회)
--   레벨 클리어(level_clear)      +100 (레벨당 1회)
--   스트릭 도달 보너스             7일 +50 / 30일 +200 (도달 시점에 자동)
--
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣고 Run
-- ============================================================

-- 1) player_status 보상 가드 컬럼
ALTER TABLE public.player_status
    ADD COLUMN IF NOT EXISTS cleared_levels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.player_status
    ADD COLUMN IF NOT EXISTS last_session_reward_date DATE;

-- 2) 챌린지 이벤트 RPC
CREATE OR REPLACE FUNCTION public.complete_challenge_event(
    p_player_id UUID,
    p_event     TEXT,   -- 'first_pass' | 'session_complete' | 'level_clear'
    p_clip_id   TEXT,   -- first_pass일 때 필수
    p_level     TEXT,   -- level_clear일 때 필수 (예: 'S1')
    p_today_kst DATE,
    p_kst_idx   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_active DATE;
    v_streak_days INT;
    v_streak_week BOOLEAN[];
    v_xp INT;
    v_level INT;
    v_xp_to_next INT;
    v_cleared TEXT[];
    v_last_session DATE;
    v_pass_count INT;
    v_xp_gained INT := 0;
    v_bonus_gained INT := 0;
    v_level_up BOOLEAN := FALSE;
    v_streak_updated BOOLEAN := FALSE;
    v_rewarded BOOLEAN := FALSE;
BEGIN
    -- 방어용 자동 생성 후 상태 로드
    INSERT INTO public.player_status (player_id)
    VALUES (p_player_id)
    ON CONFLICT (player_id) DO NOTHING;

    SELECT last_active_date, streak_days, streak_week, xp, level, xp_to_next,
           cleared_levels, last_session_reward_date
    INTO v_last_active, v_streak_days, v_streak_week, v_xp, v_level, v_xp_to_next,
         v_cleared, v_last_session
    FROM public.player_status
    WHERE player_id = p_player_id;

    -- 이벤트별 XP 및 중복 가드
    IF p_event = 'first_pass' THEN
        -- 보안: speak-score가 실제 합격을 기록했는지 검증하고,
        -- "역대 첫" 합격(=합격 로그가 정확히 1행)일 때만 지급한다.
        SELECT COUNT(*) INTO v_pass_count
        FROM public.speak_attempts_log
        WHERE player_id = p_player_id AND clip_id = p_clip_id AND passed = TRUE;

        IF v_pass_count = 1 THEN
            v_xp_gained := 15;
            v_rewarded := TRUE;
        END IF;

    ELSIF p_event = 'session_complete' THEN
        IF v_last_session IS NULL OR v_last_session != p_today_kst THEN
            v_xp_gained := 10;
            v_rewarded := TRUE;
            v_last_session := p_today_kst;
        END IF;

    ELSIF p_event = 'level_clear' THEN
        IF p_level IS NOT NULL AND p_level != '' AND NOT (p_level = ANY(v_cleared)) THEN
            -- 서버 측 검증: 해당 플레이어가 실제로 합격한 클립이 1개 이상 있어야 함
            SELECT COUNT(DISTINCT clip_id) INTO v_pass_count
            FROM public.speak_attempts_log
            WHERE player_id = p_player_id AND passed = TRUE;

            IF v_pass_count > 0 THEN
                v_xp_gained := 100;
                v_rewarded := TRUE;
                v_cleared := array_append(v_cleared, p_level);
            END IF;
        END IF;

    ELSE
        RETURN jsonb_build_object('success', FALSE, 'error', 'unknown_event');
    END IF;

    -- 스트릭 갱신 (챌린지 활동도 활성일로 집계)
    IF v_last_active IS NULL OR v_last_active != p_today_kst THEN
        IF v_last_active = p_today_kst - INTERVAL '1 day' THEN
            v_streak_days := v_streak_days + 1;
        ELSE
            v_streak_days := 1;
        END IF;
        v_streak_week[p_kst_idx + 1] := TRUE;
        v_streak_updated := TRUE;

        -- 스트릭 도달 보너스 (하루 1회만 증가하므로 == 비교가 곧 1회 지급 가드)
        IF v_streak_days = 7 THEN
            v_bonus_gained := 50;
        ELSIF v_streak_days = 30 THEN
            v_bonus_gained := 200;
        END IF;
    END IF;

    -- XP 반영 및 레벨업 (기존 공식 유지: xp_to_next = level * 3000)
    v_xp := v_xp + v_xp_gained + v_bonus_gained;
    WHILE v_xp >= v_xp_to_next LOOP
        v_level_up := TRUE;
        v_level := v_level + 1;
        v_xp := v_xp - v_xp_to_next;
        v_xp_to_next := v_level * 3000;
    END LOOP;

    UPDATE public.player_status
    SET xp = v_xp,
        level = v_level,
        xp_to_next = v_xp_to_next,
        streak_days = v_streak_days,
        streak_week = v_streak_week,
        last_active_date = p_today_kst,
        cleared_levels = v_cleared,
        last_session_reward_date = v_last_session,
        updated_at = now()
    WHERE player_id = p_player_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'rewarded', v_rewarded,
        'xpGained', v_xp_gained + v_bonus_gained,
        'streakBonus', v_bonus_gained,
        'currentXp', v_xp,
        'level', v_level,
        'xpToNext', v_xp_to_next,
        'levelUp', v_level_up,
        'streakDays', v_streak_days,
        'streakWeek', v_streak_week,
        'clearedLevels', v_cleared
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_challenge_event(UUID, TEXT, TEXT, TEXT, DATE, INTEGER) TO authenticated;
