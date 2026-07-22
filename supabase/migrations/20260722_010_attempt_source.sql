-- 010: speak_attempts_log.source — 레벨 진행 소스를 쇼츠로 한정
--
-- 진행 모델: 쇼츠 speak만 레벨(S1→S2→S3)을 올린다. 챌린지는 연습(보너스)이라
-- 레벨에 관여하지 않는다. 두 경로가 같은 speak_attempts_log를 쓰므로, 소스를
-- 구분해 passedClips(레벨 계산)는 source='shorts'만 집계하고, 챌린지 연습은
-- source='challenge'로 남겨 참여도 지표로만 활용한다.
--
-- 기존 행은 소스를 소급 판별할 수 없으므로 default 'shorts'로 둔다(체험 초기라
-- 영향 미미). 이후 신규 기록은 각 경로가 명시적으로 값을 넣는다.

alter table public.speak_attempts_log
  add column if not exists source text not null default 'shorts';

-- 레벨 계산 쿼리(passed + source 필터)를 위한 부분 인덱스
create index if not exists speak_attempts_log_player_source_idx
  on public.speak_attempts_log (player_id, source);
