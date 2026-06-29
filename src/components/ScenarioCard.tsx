'use client';

import React, { useEffect, useState } from 'react';
import { INTERVIEW_SCENARIOS, ScenarioId } from '@/constants/interviewScenarios';

interface ScenarioCardProps {
    scenarioId: ScenarioId;
    onComplete: () => void;
}

export default function ScenarioCard({ scenarioId, onComplete }: ScenarioCardProps) {
    const [progress, setProgress] = useState(0);
    const DURATION = 3000; // 3 seconds

    const scenario = INTERVIEW_SCENARIOS.find((s) => s.id === scenarioId);

    useEffect(() => {
        let startTime = Date.now();
        let animationFrameId: number;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const currentProgress = Math.min((elapsed / DURATION) * 100, 100);
            setProgress(currentProgress);

            if (elapsed < DURATION) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                onComplete();
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [onComplete]);

    if (!scenario) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
                {scenario.icon}
            </div>
            <h2 style={{ 
                fontSize: '1.8rem', 
                fontWeight: 'bold', 
                marginBottom: '1rem',
                color: 'var(--text-primary, #ffffff)' 
            }}>
                {scenario.title_ko}
            </h2>
            <p style={{ 
                fontSize: '1.2rem', 
                color: 'var(--text-secondary, #a0aec0)',
                marginBottom: '3rem',
                maxWidth: '400px',
                lineHeight: '1.5'
            }}>
                {scenario.description}
            </p>

            <div style={{
                width: '100%',
                maxWidth: '300px',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'var(--primary-color, #4ade80)',
                    transition: 'width 0.1s linear'
                }} />
            </div>
            <p style={{ 
                marginTop: '1rem', 
                fontSize: '0.9rem', 
                color: 'var(--text-secondary, #a0aec0)' 
            }}>
                곧 인터뷰가 시작됩니다...
            </p>
        </div>
    );
}
