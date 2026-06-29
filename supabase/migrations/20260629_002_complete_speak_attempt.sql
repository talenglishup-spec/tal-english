-- ============================================================
-- TAL Migration: complete_speak_attempt RPC Stored Function
-- Path: supabase/migrations/20260629_002_complete_speak_attempt.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_speak_attempt(
    p_player_id UUID,
    p_clip_id TEXT,
    p_card_id TEXT,
    p_today_kst DATE,
    p_kst_idx INTEGER
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
    v_piece_count INT;
    v_unlocked BOOLEAN;
    v_already_rewarded BOOLEAN := FALSE;
    v_xp_gained INT := 0;
    v_level_up BOOLEAN := FALSE;
    v_just_unlocked BOOLEAN := FALSE;
BEGIN
    -- 1. 중복 보상 수령 방지 대조 (오늘 KST 날짜 기준 passed=true 이력 존재 유무)
    SELECT EXISTS (
        SELECT 1 FROM public.speak_attempts_log
        WHERE player_id = p_player_id
          AND clip_id = p_clip_id
          AND passed = TRUE
          AND (created_at AT TIME ZONE 'Asia/Seoul')::date = p_today_kst
    ) INTO v_already_rewarded;

    -- player_status 레코드 조회 및 방어용 자동 생성
    INSERT INTO public.player_status (player_id)
    VALUES (p_player_id)
    ON CONFLICT (player_id) DO NOTHING;

    SELECT last_active_date, streak_days, streak_week, xp, level, xp_to_next
    INTO v_last_active, v_streak_days, v_streak_week, v_xp, v_level, v_xp_to_next
    FROM public.player_status
    WHERE player_id = p_player_id;

    -- player_collection 레코드 조회 및 방어용 자동 생성
    INSERT INTO public.player_collection (player_id, card_id)
    VALUES (p_player_id, p_card_id)
    ON CONFLICT (player_id, card_id) DO NOTHING;

    SELECT piece_count, unlocked
    INTO v_piece_count, v_unlocked
    FROM public.player_collection
    WHERE player_id = p_player_id AND card_id = p_card_id;

    -- 중복 호출 시, DB 업데이트는 스킵하고 현재 보유 상태 그대로 리턴
    IF v_already_rewarded THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'alreadyRewarded', TRUE,
            'xpGained', 0,
            'currentXp', v_xp,
            'level', v_level,
            'xpToNext', v_xp_to_next,
            'levelUp', FALSE,
            'streakDays', v_streak_days,
            'streakWeek', v_streak_week,
            'pieceCount', v_piece_count,
            'unlockedCard', v_unlocked,
            'justUnlocked', FALSE
        );
    END IF;

    -- 2. 스트릭(연속 활성일) 갱신
    IF v_last_active IS NULL OR v_last_active != p_today_kst THEN
        IF v_last_active = p_today_kst - INTERVAL '1 day' THEN
            v_streak_days := v_streak_days + 1;
        ELSE
            v_streak_days := 1;
        END IF;
        -- postgresql 배열 인덱스는 1부터 시작하므로 p_kst_idx + 1 처리
        v_streak_week[p_kst_idx + 1] := TRUE;
    END IF;

    -- 3. XP 지급 및 OVR 레벨업 체크
    v_xp_gained := 50;
    v_xp := v_xp + v_xp_gained;
    IF v_xp >= v_xp_to_next THEN
        v_level_up := TRUE;
        v_level := v_level + 1;
        v_xp := v_xp - v_xp_to_next;
        v_xp_to_next := v_level * 3000;
    END IF;

    UPDATE public.player_status
    SET xp = v_xp,
        level = v_level,
        xp_to_next = v_xp_to_next,
        streak_days = v_streak_days,
        streak_week = v_streak_week,
        last_active_date = p_today_kst,
        updated_at = now()
    WHERE player_id = p_player_id;

    -- 4. 카드 조각 갱신
    v_piece_count := LEAST(30, v_piece_count + 1);
    IF v_piece_count >= 30 AND NOT v_unlocked THEN
        v_unlocked := TRUE;
        v_just_unlocked := TRUE;
    END IF;

    UPDATE public.player_collection
    SET piece_count = v_piece_count,
        unlocked = v_unlocked,
        unlocked_at = CASE WHEN v_just_unlocked THEN now() ELSE unlocked_at END,
        updated_at = now()
    WHERE player_id = p_player_id AND card_id = p_card_id;

    -- 5. 중복 방지 검증을 위한 attempts_log 적재
    INSERT INTO public.speak_attempts_log (player_id, clip_id, passed, created_at)
    VALUES (p_player_id, p_clip_id, TRUE, now());

    RETURN jsonb_build_object(
        'success', TRUE,
        'alreadyRewarded', FALSE,
        'xpGained', v_xp_gained,
        'currentXp', v_xp,
        'level', v_level,
        'xpToNext', v_xp_to_next,
        'levelUp', v_level_up,
        'streakDays', v_streak_days,
        'streakWeek', v_streak_week,
        'pieceCount', v_piece_count,
        'unlockedCard', v_unlocked,
        'justUnlocked', v_just_unlocked
    );
END;
$$;
