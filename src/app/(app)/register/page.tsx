'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './RegisterPage.module.css';


const LEVELS = [
    { value: 'L1', label: 'L1 — Beginner', desc: '기초 영어 표현 학습' },
    { value: 'L2', label: 'L2 — Elementary', desc: '기본 문장 구성 가능' },
    { value: 'L3', label: 'L3 — Intermediate', desc: '일상 인터뷰 응답 가능' },
    { value: 'L4', label: 'L4 — Advanced', desc: '자연스러운 영어 소통 가능' },
];

type Step = 1 | 2 | 3 | 'done';

export default function RegisterPage() {
    const router = useRouter();

    // Step 1
    const [name, setName] = useState('');
    const [position, setPosition] = useState('');
    const [teamCode, setTeamCode] = useState('');
    const [showTeamCode, setShowTeamCode] = useState(false);
    const [step1Error, setStep1Error] = useState('');
    const [step1Loading, setStep1Loading] = useState(false);

    // Step 2
    const [level, setLevel] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Done
    const [playerId, setPlayerId] = useState('');
    const [password, setPassword] = useState('');

    const [step, setStep] = useState<Step>(1);

    const validateAndNext = async () => {
        setStep1Error('');
        if (teamCode && teamCode.trim() !== '') {
            setStep1Loading(true);
            try {
                const res = await fetch('/api/team/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team_code: teamCode }),
                });
                const data = await res.json();
                if (res.ok && data.valid) {
                    setStep(2);
                } else {
                    setStep1Error(data.error || '유효하지 않은 팀 코드입니다. 코드를 확인하거나 비워두고 진행하세요.');
                }
            } catch {
                setStep1Error('네트워크 오류가 발생했습니다.');
            } finally {
                setStep1Loading(false);
            }
        } else {
            setStep(2);
        }
    };

    const handleRegister = async () => {
        setSubmitError('');
        setSubmitLoading(true);
        try {
            const res = await fetch('/api/player/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, position, team_code: teamCode, level }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setPlayerId(data.player_id);
                setPassword(data.password);
                setStep('done');
            } else {
                setSubmitError(data.error || '등록에 실패했습니다.');
            }
        } catch {
            setSubmitError('네트워크 오류가 발생했습니다.');
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.brand}>
                    <h1 className={styles.title}>Take A Leap</h1>
                    <p className={styles.subtitle}>선수 등록</p>
                </div>

                {step !== 'done' && (
                    <div className={styles.stepBar}>
                        {[1, 2].map((s) => (
                            <div
                                key={s}
                                className={`${styles.stepDot} ${step === s ? styles.active : Number(step) > s ? styles.done : ''}`}
                            />
                        ))}
                    </div>
                )}

                {/* Step 1 — Basic Info & Optional Team Code */}
                {step === 1 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>기본 정보</h2>
                        <p className={styles.stepDesc}>이름과 포지션을 입력하세요.</p>
                        
                        <div className={styles.inputGroup}>
                            <label>닉네임</label>
                            <input
                                name="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="닉네임"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>포지션</label>
                            <select
                                name="position"
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                required
                            >
                                <option value="" disabled>포지션 선택</option>
                                <option value="FW">⚡ 공격수 (FW)</option>
                                <option value="MF">🔄 미드필더 (MF)</option>
                                <option value="CB">🛡️ 수비수 (CB)</option>
                                <option value="GK">🧤 골키퍼 (GK)</option>
                            </select>
                        </div>

                        <div style={{ marginTop: '12px' }}>
                            <button
                                type="button"
                                className={styles.toggleBtn}
                                onClick={() => setShowTeamCode(!showTeamCode)}
                            >
                                {showTeamCode ? '▲' : '▼'} 팀 코드 있어? (선택사항)
                            </button>

                            {showTeamCode && (
                                <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                                    <input
                                        name="team_code"
                                        type="text"
                                        value={teamCode}
                                        onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                                        placeholder="팀 코드 입력 (예: TAL-X3K9)"
                                    />
                                    <p style={{ color: '#00E676', fontSize: '12px', marginTop: '4px' }}>
                                        🏆 팀 코드를 입력하면 같은 팀 선수들과 주간 랭킹을 공유할 수 있어요!
                                    </p>
                                    {step1Error && <div className={styles.error} style={{ marginTop: '8px' }}>{step1Error}</div>}
                                </div>
                            )}
                        </div>

                        <button
                            className={styles.btn}
                            onClick={validateAndNext}
                            disabled={!name.trim() || !position || step1Loading}
                        >
                            {step1Loading ? '확인 중...' : '다음'}
                        </button>
                    </div>
                )}

                {/* Step 2 — Level */}
                {step === 2 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>영어 레벨 선택</h2>
                        <p className={styles.stepDesc}>현재 본인의 영어 수준과 가장 가까운 레벨을 선택하세요.</p>
                        <div className={styles.levelList}>
                            {LEVELS.map((l) => (
                                <button
                                    key={l.value}
                                    type="button"
                                    className={`${styles.levelItem} ${level === l.value ? styles.levelActive : ''}`}
                                    onClick={() => setLevel(l.value)}
                                >
                                    <span className={styles.levelLabel}>{l.label}</span>
                                    <span className={styles.levelDesc}>{l.desc}</span>
                                </button>
                            ))}
                        </div>
                        {submitError && <div className={styles.error}>{submitError}</div>}
                        <div className={styles.btnRow}>
                            <button className={styles.btnSecondary} onClick={() => setStep(1)}>이전</button>
                            <button
                                className={styles.btn}
                                onClick={handleRegister}
                                disabled={!level || submitLoading}
                            >
                                {submitLoading ? '등록 중...' : '등록 완료'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Done */}
                {step === 'done' && (
                    <div className={styles.stepContent}>
                        <div className={styles.successIcon}>✓</div>
                        <h2 className={styles.stepTitle}>등록 완료!</h2>
                        <p className={styles.stepDesc}>아래 정보로 로그인하세요.</p>
                        <div className={styles.credentialBox}>
                            <div className={styles.credentialRow}>
                                <span className={styles.credentialLabel}>Player ID</span>
                                <span className={styles.credentialValue}>{playerId}</span>
                            </div>
                            <div className={styles.credentialRow}>
                                <span className={styles.credentialLabel}>Password</span>
                                <span className={styles.credentialValue}>{password}</span>
                            </div>
                        </div>
                        <p className={styles.credentialNote}>이 정보를 안전한 곳에 저장하세요.</p>
                        <button className={styles.btn} onClick={() => router.push('/')}>
                            로그인하러 가기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
