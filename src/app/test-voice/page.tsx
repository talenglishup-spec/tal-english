'use client';

import React, { useState } from 'react';

const VOICES = [
    { id: 'onyx', name: 'Onyx', desc: '굵고 낮은 톤 (코치님 추천 🏋️‍♂️)', gender: 'Male' },
    { id: 'nova', name: 'Nova', desc: '활기차고 또렷함 (선생님 추천 👩‍🏫)', gender: 'Female' },
    { id: 'alloy', name: 'Alloy', desc: '중립적이고 무난함', gender: 'Neutral' },
    { id: 'echo', name: 'Echo', desc: '부드러운 남성 톤', gender: 'Male' },
    { id: 'fable', name: 'Fable', desc: '영국식 악센트 느낌', gender: 'Male' },
    { id: 'shimmer', name: 'Shimmer', desc: '맑고 선명한 여성 톤', gender: 'Female' },
];

const SAMPLE_TEXT = "Good job! Keep your eyes on the ball and stay focused. You are doing great.";

export default function TestVoicePage() {
    const [playing, setPlaying] = useState<string | null>(null);

    const playVoice = async (voiceId: string) => {
        if (playing) return;
        setPlaying(voiceId);

        try {
            const res = await fetch('/api/test-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: SAMPLE_TEXT,
                    voice: voiceId
                }),
            });

            if (!res.ok) throw new Error('TTS Failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);

            audio.onended = () => {
                setPlaying(null);
                URL.revokeObjectURL(url);
            };

            audio.play();
        } catch (e) {
            console.error(e);
            alert('오디오 생성 실패');
            setPlaying(null);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h1 style={{ marginBottom: '1rem' }}>🎙️ 목소리 테스트</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
                아래 버튼을 눌러보시고 가장 마음에 드는 목소리를 알려주세요.
                <br />
                <span style={{ fontSize: '0.9rem', color: '#999' }}>* 예시 문장: "{SAMPLE_TEXT}"</span>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {VOICES.map((v) => (
                    <div key={v.id} style={{
                        border: '1px solid #ddd',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        display: 'flex',
                        justify- content: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                    }}>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '4px' }}>
                        {v.name} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>{v.gender}</span>
                    </div>
                    <div style={{ color: '#555' }}>{v.desc}</div>
                </div>

                <button
                    onClick={() => playVoice(v.id)}
                    disabled={!!playing}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '25px',
                        border: 'none',
                        background: playing === v.id ? '#ccc' : '#0070f3',
                        color: 'white',
                        cursor: playing ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {playing === v.id ? '재생 중...' : '들어보기 ▶'}
                </button>
            </div>
                ))}
        </div>
        </div >
    );
}
