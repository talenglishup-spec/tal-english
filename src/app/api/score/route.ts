import { NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/whisper';

// Helper for fuzzy comparison
function calculateFuzzyScore(transcript: string, answer: string): number {
  if (!transcript) return 0;
  
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const tNorm = normalize(transcript);
  const aNorm = normalize(answer);

  if (tNorm === aNorm) return 100;

  const tWords = tNorm.split(/\s+/).filter(Boolean);
  const aWords = aNorm.split(/\s+/).filter(Boolean);

  if (aWords.length === 0) return 0;

  let matchCount = 0;
  for (const aWord of aWords) {
    if (tWords.includes(aWord)) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / aWords.length;

  if (matchRatio === 1) return 90; // All answer words present, but not exact match
  if (matchRatio >= 0.5) return 70 + Math.floor(matchRatio * 15);
  if (matchRatio > 0) return 40 + Math.floor(matchRatio * 20);
  
  return 20; // Some audio was processed but no match
}

export async function POST(request: Request) {
  try {
    const { audio_url, answer, player_id } = await request.json();

    if (!audio_url || !answer) {
      return NextResponse.json({ error: 'audio_url and answer are required' }, { status: 400 });
    }

    // 1. Fetch audio from Supabase URL
    const response = await fetch(audio_url);
    if (!response.ok) {
        throw new Error(`Failed to fetch audio from URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Transcribe via Whisper
    const transcript = await transcribeAudio(buffer);

    // 3. Fuzzy compare
    const score = calculateFuzzyScore(transcript, answer);

    return NextResponse.json({
      score,
      transcript
    });

  } catch (error: any) {
    console.error('Score API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
