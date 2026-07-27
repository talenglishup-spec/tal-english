-- 013: clip_view_log — 클립 단위 시청·Speak 전환 추적
--
-- 지금은 "합격한 시도"만 speak_attempts_log에 남아, 아래를 알 수 없다.
--   · 어떤 클립에서 이탈하는가 (클립별 체류시간)
--   · Speak 버튼은 눌렀는데 녹음까지 안 간 비율 (= 포기율)
-- 쇼츠에서 클립이 비활성화될 때(스크롤로 넘어갈 때) 1행씩 적재한다.
--
-- 설계 노트
--  · 스크롤마다 즉시 INSERT하면 재생 중 네트워크가 튀므로 클라이언트가
--    버퍼링해 /api/track으로 배치 전송한다(activity_log와 동일 경로).
--  · speak_triggered: 🎙️ Speak 버튼을 눌러 발화 모드에 진입했는가
--    speak_completed: 녹음까지 마쳐 채점 결과를 받았는가
--    → 포기율 = (triggered - completed) / triggered

create table if not exists public.clip_view_log (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  clip_id     text not null,
  dwell_ms    integer,                                  -- 그 클립에 머문 시간
  speak_triggered boolean not null default false,
  speak_completed boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.clip_view_log enable row level security;

-- 본인 행만 기록·조회 (관리자 집계는 service-role로 우회)
drop policy if exists "clip_view_log_insert_own" on public.clip_view_log;
create policy "clip_view_log_insert_own" on public.clip_view_log
  for insert with check (auth.uid() = player_id);

drop policy if exists "clip_view_log_select_own" on public.clip_view_log;
create policy "clip_view_log_select_own" on public.clip_view_log
  for select using (auth.uid() = player_id);

-- 클립별 집계 / 기간 필터용
create index if not exists clip_view_log_clip_idx on public.clip_view_log (clip_id);
create index if not exists clip_view_log_player_created_idx
  on public.clip_view_log (player_id, created_at desc);
