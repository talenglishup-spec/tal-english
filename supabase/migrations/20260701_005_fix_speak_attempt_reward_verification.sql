-- ============================================================
-- TAL Migration: Fix complete_speak_attempt reward verification
-- Path: supabase/migrations/20260701_005_fix_speak_attempt_reward_verification.sql
--
-- 문제 1 (보안): complete_speak_attempt RPC는 clip_id/card_id만 주어지면
-- 무조건 XP/카드 조각을 지급했다. 실제로 speak-score API를 통해 정답을
-- 맞췄는지 검증하지 않아, 로그인한 클라이언트가 /api/train/complete를
-- 직접 호출해 무제한으로 보상을 받을 수 있었다.
--
-- 문제 2 (기능 버그): speak-score API가 채점 직후 passed=TRUE 로그를
-- speak_attempts_log에 먼저 적재하는데, 뒤이어 호출되는 이 RPC의 "오늘
-- 이미 보상 받았는가" 판별 로직이 바로 그 로그를 "이미 보상됨"으로
-- 오인해서, 실제로 막 정답을 맞춘 유저도 XP를 못 받고 있었다.
--
-- 해결: speak_attempts_log에 rewarded 플래그를 추가해 "채점 기록"과
-- "보상 지급 여부"를 분리한다. RPC는 (a) 아직 보상되지 않은 passed=TRUE
-- 기록이 실제로 존재하는지 검증하고, (b) 있으면 그 기록 자체를
-- rewarded=TRUE로 마킹한다 (새 행을 또 쌓지 않음).
-- ============================================================

ALTER TABLE public.speak_attempts_log
    ADD COLUMN IF NOT EXISTS rewarded BOOLEAN NOT NULL DEFAULT FALSE;

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
    v_attempt_id UUID;
    v_xp_gained INT := 0;
    v_level_up BOOLEAN := FALSE;
    v_just_unlocked BOOLEAN := FALSE;
BEGIN
    -- 1. 오늘 KST 기준 이미 보상이 지급된 이력이 있는지 확인 (진짜 중복 방지 —
    --    passed 기록 존재 여부가 아니라 rewarded 플래그로 판별한다)
    SELECT EXISTS (
        SELECT 1 FROM public.speak_attempts_log
        WHERE player_id = p_player_id
          AND clip_id = p_clip_id
          AND rewarded = TRUE
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

    -- 2. 실제로 STT 채점을 통과했고 아직 보상되지 않은 기록이 있는지 검증.
    --    없다면 클라이언트가 speak-score를 거치지 않고 이 RPC를 직접
    --    호출한 것이므로 보상을 지급하지 않는다.
    SELECT id INTO v_attempt_id
    FROM public.speak_attempts_log
    WHERE player_id = p_player_id
      AND clip_id = p_clip_id
      AND passed = TRUE
      AND rewarded = FALSE
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_attempt_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'no_valid_attempt'
        );
    END IF;

    -- 3. 스트릭(연속 활성일) 갱신
    IF v_last_active IS NULL OR v_last_active != p_today_kst THEN
        IF v_last_active = p_today_kst - INTERVAL '1 day' THEN
            v_streak_days := v_streak_days + 1;
        ELSE
            v_streak_days := 1;
        END IF;
        v_streak_week[p_kst_idx + 1] := TRUE;
    END IF;

    -- 4. XP 지급 및 레벨업 체크
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

    -- 5. 카드 조각 갱신
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

    -- 6. 검증에 사용한 채점 기록을 보상 완료로 마킹한다 (새 로그 행을
    --    추가로 쌓지 않고 기존 행을 갱신 — 이전 버전은 여기서
    --    speak_attempts_log에 새 행을 INSERT했는데, 이는 speak-score가
    --    이미 남긴 행과 함께 "오늘 몇 번 시도했는지" 집계를 왜곡시켰다)
    UPDATE public.speak_attempts_log
    SET rewarded = TRUE
    WHERE id = v_attempt_id;

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
