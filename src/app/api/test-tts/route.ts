import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/utils/openai';

export async function POST(req: NextRequest) {
    try {
        const { text, voice } = await req.json();

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice || "alloy",
            input: text || "Hello, this is a test.",
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error: any) {
        console.error('TTS Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
