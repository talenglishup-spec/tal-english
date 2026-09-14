-- 014: 온보딩 선택 항목 (포지션 · 소속 팀/학교)
--
-- 목적:
--  · position — 콘텐츠 쪽엔 filterByPosition(FW/MF/DF/GK)이 이미 있는데, 정작
--    유저에게 포지션을 물은 적이 없어 한 번도 쓰인 적 없는 필터였다. 값을 받는
--    자리를 만든다. 값은 PositionTag와 정확히 맞춘다('DF', 'CB' 아님 — 예전
--    /register가 'CB'를 써서 필터가 조용히 안 먹혔던 것과 같은 실수를 반복하지
--    않기 위해 여기 명시해 둔다).
--  · affiliation — 체험단 팀을 나중에 이메일로 일일이 대조하는 대신, 가입
--    시점에 자유 텍스트로 소속(팀·학교명)을 받아 코호트를 바로 태깅한다.
--
-- 둘 다 필수 3문항(생년월일·공부기간·자신감)과 달리 선택이며, 온보딩 진행을
-- 막지 않는다.

alter table public.profiles
  add column if not exists position text,      -- 'FW' | 'MF' | 'DF' | 'GK' (선택, null 허용)
  add column if not exists affiliation text;    -- 자유 텍스트, 최대 40자(클라이언트에서 제한)
