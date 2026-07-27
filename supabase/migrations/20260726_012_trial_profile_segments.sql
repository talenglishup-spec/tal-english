-- 012: 체험단 세그먼트용 프로필 항목 (생년월일 · 영어 학습기간 · 자기평가 레벨)
--
-- 목적: 체험단 결과를 "집단별"로 추적한다. 지금 profiles에는 인구통계가 전무해
-- 집단 구분 자체가 불가능하다. 온보딩에서 3문항만 받아(마찰 최소화) 아래 컬럼을
-- 채우고, 관리자 대시보드가 이 값으로 지표를 분해한다.
--
-- 설계 노트
--  · birth_date: 생년월일 원본을 저장하고 나이는 분석 시점에 파생한다(해가 바뀌어도
--    정확하고, "체험 시작 시점 나이"를 재계산할 수 있다).
--  · self_level: 앱이 이미 객관적 레벨(S1→S2→S3)을 측정하므로, 자기평가는 별개
--    값으로 받아 "자신감 vs 실제 실력" 격차를 분석하는 데 쓴다.
--  · profile_filled_at: 마이 탭에서 값을 수정해도 최초 응답 시점은 보존한다.
--  · 기존 가입자는 전부 내부 테스트 계정이라 소급 수집이 필요 없다(사용자 확인).

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists study_years text,        -- 'under1' | '1to3' | '3to5' | 'over5'
  add column if not exists self_level text,         -- 'none' | 'little' | 'normal' | 'good'
  add column if not exists profile_filled_at timestamptz;

-- 세그먼트 집계 시 자주 함께 걸리는 조합
create index if not exists profiles_segment_idx
  on public.profiles (study_years, self_level);
