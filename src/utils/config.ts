
export const TTS_CONFIG = {
    // alloy, echo, fable, onyx, nova, shimmer
    voice: 'alloy' as const,
    model: 'tts-1' as const,
};

// ── ElevenLabs — AI 모범답안 TTS (쇼츠 Speak 리뷰, US/UK 억양 2종) ──
// 보이스는 ElevenLabs 기본 제공(premade) 남성 보이스를 기본값으로 하되
// env로 교체 가능하다. (Adam = American, Daniel = British)
export const ELEVEN_CONFIG = {
    apiKey: () => process.env.ELEVENLABS_API_KEY || '',
    modelId: 'eleven_multilingual_v2',
    voices: {
        us: process.env.ELEVENLABS_VOICE_US || 'pNInz6obpgDQGcFmaJgB', // Adam (US)
        uk: process.env.ELEVENLABS_VOICE_UK || 'onwK4e9ZLuTAKqWW03F9', // Daniel (UK)
    } as Record<'us' | 'uk', string>,
};
