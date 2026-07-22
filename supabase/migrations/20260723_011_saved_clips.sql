-- 011: saved_clips — 영상 저장(북마크)
--
-- 쇼츠에서 우측 레일의 저장 버튼으로 clip을 북마크한다. 영상 파일을 저장하는
-- 것이 아니라 "이 clip을 다시 보고 싶다"는 표시(clip_id)만 남기고, 볼 때는
-- 동일하게 유튜브 임베드로 재생한다(다운로드·재배포 아님 — ToS 준수).
-- 마이 탭 "저장한 영상"에서 본인 저장 목록을 최신순으로 본다.

create table if not exists public.saved_clips (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  clip_id text not null,
  created_at timestamptz not null default now(),
  unique (player_id, clip_id)   -- 같은 clip 중복 저장 방지 (토글)
);

alter table public.saved_clips enable row level security;

-- 본인 행만 조회·저장·해제
drop policy if exists "saved_clips_select_own" on public.saved_clips;
create policy "saved_clips_select_own" on public.saved_clips
  for select using (auth.uid() = player_id);

drop policy if exists "saved_clips_insert_own" on public.saved_clips;
create policy "saved_clips_insert_own" on public.saved_clips
  for insert with check (auth.uid() = player_id);

drop policy if exists "saved_clips_delete_own" on public.saved_clips;
create policy "saved_clips_delete_own" on public.saved_clips
  for delete using (auth.uid() = player_id);

-- 마이 탭 목록(최신순) 조회용
create index if not exists saved_clips_player_created_idx
  on public.saved_clips (player_id, created_at desc);
