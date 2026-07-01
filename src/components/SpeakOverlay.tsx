'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from '../app/shorts/ShortsPage.module.css';

interface SpeakOverlayProps {
  targetPhrase: string;
  clipId: string;
  onClose: (passed: boolean) => void;
  onSkip: () => void;
}

export default function SpeakOverlay({ targetPhrase, clipId, onClose, onSkip }: SpeakOverlayProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0: Ready, 1: Countdown, 2: Recording, 3: Result
  const [countdown, setCountdown] = useState(3);
  const [recordingLeft, setRecordingLeft] = useState(5.0);
  const [passed, setPassed] = useState<boolean | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // iOS Safari: User click direct trigger to getUserMedia to preserve gesture context
  const handleStartChallenge = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStep(1); // Proceed to countdown
    } catch (err) {
      console.error('[SpeakOverlay] Microphone permission denied:', err);
      alert('마이크 사용 권한이 필요합니다. 설정에서 활성화 후 시도해주세요.');
      onSkip();
    }
  };

  // Countdown timer loop
  useEffect(() => {
    if (step !== 1) return;

    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    } else {
      // Countdown finished -> Start recording
      startRecording();
    }
  }, [countdown, step]);

  // Recording circular progress timer loop
  useEffect(() => {
    if (step !== 2) return;

    const start = Date.now();
    const duration = 5000;

    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, (duration - elapsed) / 1000);
      setRecordingLeft(remaining);

      if (elapsed >= duration) {
        stopRecording();
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [step]);

  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        await evaluateSpeech();
      };

      recorder.start();
      setStep(2);
    } catch (err) {
      console.error('[SpeakOverlay] Recording failed:', err);
      onSkip();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const evaluateSpeech = async () => {
    setStep(3);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');
      formData.append('clip_id', clipId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/train/speak-score', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('API request failed');

      const data = await res.json();
      setPassed(data.passed);

      setTimeout(() => {
        onClose(data.passed);
      }, 1500);

    } catch (err) {
      // STT 채점 실패/타임아웃을 자동 합격 처리하면 오디오 업로드를 일부러
      // 실패시켜 보상을 받는 우회가 가능해지므로, 실패로 처리한다.
      console.warn('[SpeakOverlay] STT evaluation failed/timeout.', err);
      setPassed(false);
      setTimeout(() => {
        onClose(false);
      }, 1500);
    }
  };

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (recordingLeft / 5.0) * circumference;

  return (
    <div className={styles.overlayBackdrop}>
      {step === 0 && (
        <>
          <p className={styles.overlayTitle}>준비되면 아래 마이크를 탭하세요!</p>
          <div className={styles.circleWrapper}>
            <button 
              type="button" 
              onClick={handleStartChallenge} 
              className={`${styles.micBtn} ${styles.micBtnActive}`}
              style={{ background: '#3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
            >
              🎙️
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>마이크 권한 획득 후 훈련을 시작합니다</p>
        </>
      )}

      {step === 1 && (
        <>
          <p className={styles.overlayTitle}>선수 대신 네가 말해봐!</p>
          <div className={styles.circleWrapper}>
            <span className={styles.countdownNum}>{countdown}</span>
          </div>
          <button type="button" className={`${styles.micBtn} ${styles.micBtnDim}`} disabled>
            🎙️
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className={styles.overlayTitle}>듣고 큰소리로 말하세요!</p>
          <div className={styles.circleWrapper}>
            <svg className={styles.progressRing} width="80" height="80">
              <circle
                stroke="rgba(255,255,255,0.1)"
                fill="transparent"
                strokeWidth="4"
                r={radius}
                cx="40"
                cy="40"
              />
              <circle
                stroke="#ef4444"
                fill="transparent"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                r={radius}
                cx="40"
                cy="40"
              />
            </svg>
            <button type="button" onClick={stopRecording} className={`${styles.micBtn} ${styles.micBtnActive}`}>
              🎙️
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>탭하여 완료</p>
        </>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center' }}>
          {passed === null ? (
            <p className={styles.overlayTitle}>발음 분석 중...</p>
          ) : passed ? (
            <div className={`${styles.statusIcon} ${styles.successIcon}`}>✓</div>
          ) : (
            <div className={`${styles.statusIcon} ${styles.failIcon}`}>✗</div>
          )}
        </div>
      )}

      <button type="button" onClick={onSkip} className={styles.btnSkipOverlay}>
        SKIP
      </button>
    </div>
  );
}
