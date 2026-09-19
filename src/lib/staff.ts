/**
 * 운영진 계정 — 쇼츠 피드 전체 보기(레벨 게이트 없음)와, 체험단 분석에서 제외할
 * 계정의 단일 목록. 둘이 따로 관리되면 한쪽만 고쳐져 분석에 운영진 기록이 섞인다.
 */
export const STAFF_EMAILS = [
  'tal.english.up@gmail.com', // 관리자
  'tal.qa.claude@gmail.com',  // QA 테스트 계정
];

export const isStaffEmail = (email?: string | null) =>
  !!email && STAFF_EMAILS.includes(email.trim().toLowerCase());
