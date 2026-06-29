import { NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';
import { calculateScore } from '@/utils/score';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetEn = formData.get('target_en') as string | null;

    if (!file || !targetEn) {
      return NextResponse.json(
        { error: 'file and target_en are required' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Transcribe via Whisper
    const transcript = await transcribeAudio(buffer);

    // Calculate Score using existing logic
    const { score, feedback } = calculateScore(targetEn, transcript);

    return NextResponse.json({
      success: true,
      score,
      transcript,
      feedback,
    });
  } catch (error: any) {
    console.error('[Learn Modes Demo Score API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
