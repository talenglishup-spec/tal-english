import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // NOTE: PDF 게이트가 퍼널 최적화를 위해 B2B 전용으로 전환되었습니다.
  // 추후 B2B 재활용 시 이 라우트를 복원하여 사용하세요.
  return NextResponse.json({ error: 'Gone', success: false }, { status: 410 });
}
