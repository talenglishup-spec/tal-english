'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './SpeakMode.module.css';

interface SpeakModeProps {
  updateXp: (amount: number) => void;
}

const SPEAK_ITEMS = [
  {
    id: 'pep-2',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kids-playing-soccer-in-a-field-31663-large.mp4',
    promptKr: '어떻게든 점유율을 유지해.',
    targetEn: "Keep the possession at all costs.",
    stopTime: 1.2, // Stop just before this second to prompt recording
    playerName: '펩 과르디올라',
  },
  {
    id: 'sonny-2',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-the-rain-31657-large.mp4',
    promptKr: '정말 기막힌 패스였어!',
    targetEn: "What a peach of a pass!",
    stopTime: 1.5,
    playerName: '손흥민',
  }
];

export default function SpeakMode({ updateXp }: SpeakModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = SPEAK_ITEMS[currentIndex];

  const [phase, setPhase] = useState<1 | 2>(1); // 1 = Whole video play, 2 = Stop & Record
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Scoring result state
  const [scoreResult, setScoreResult] = useState<'success' | 'failed' | null>(null);
  const [scoreDetail, setScoreDetail] = useState<{ score: number; transcript: string; feedback: string } | null>(null);

  // Success tracking (for Advanced mode unlock)
  const [successCounts, setSuccessCounts] = useState<Record<string, number>>({});
  const [advancedMode, setAdvancedMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTriggeredRef = useRef(false);

  // Load success counts
  useEffect(() => {
    const savedCounts = localStorage.getItem('tal_demo_speak_success');
    if (savedCounts) {
      try {
        setSuccessCounts(JSON.parse(savedCounts));
      } catch (e) {
        setSuccessCounts({});
      }
    }
  }, []);

  useEffect(() => {
    // Reset state for new item
    setPhase(1);
    setIsRecording(false);
    setIsAnalyzing(false);
    setScoreResult(null);
    setScoreDetail(null);
    stopTriggeredRef.current = false;
    setIsPlaying(true);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentItem || stopTriggeredRef.current) return;
    const video = videoRef.current;

    // Advanced mode: Hide text cues and stop timing cues.
    // In normal mode, stop at stopTime on 2nd phase (or let's just trigger stop on 2nd playback loop).
    if (phase === 2 && video.currentTime >= currentItem.stopTime) {
      stopTriggeredRef.current = true;
      video.pause();
      setIsPlaying(false);
      
      // Auto trigger Recording after a tiny delay
      setTimeout(() => {
        startRecording();
      }, 500);
    }
  };

  const handleVideoEnded = () => {
    if (phase === 1) {
      // Loop back for 2nd phase (Stop & speak)
      setPhase(2);
      stopTriggeredRef.current = false;
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else if (phase === 2 && scoreResult === 'success') {
      // Completed current item, prompt next
      setTimeout(() => {
        alert('성공! 다음 표현으로 이동합니다.');
        handleNextItem();
      }, 1500);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all media tracks
        stream.getTracks().forEach(t => t.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        submitAudio(audioBlob);
      };

      setRecordingTimer(4); // 4 seconds timer
      setIsRecording(true);
      mediaRecorder.start();

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => {
          if (prev <= 1) {
            clearInterval(recordingIntervalRef.current!);
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error('마이크 접근 에러:', err);
      alert('마이크 접근 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const submitAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    setScoreResult(null);

    const formData = new FormData();
    formData.append('file', blob, 'speak-attempt.webm');
    formData.append('target_en', currentItem.targetEn);

    try {
      const res = await fetch('/api/learn-modes-demo/score', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('API request failed');

      const data = await res.json();
      
      setIsAnalyzing(false);
      setScoreDetail(data);

      if (data.score >= 80) {
        setScoreResult('success');
        updateXp(30);
        
        // Update success counts in LocalStorage
        const updatedCounts = { ...successCounts, [currentItem.id]: (successCounts[currentItem.id] || 0) + 1 };
        setSuccessCounts(updatedCounts);
        localStorage.setItem('tal_demo_speak_success', JSON.stringify(updatedCounts));

        // Resume playing the rest of the video
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      } else {
        setScoreResult('failed');
      }
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      alert('채점 중 오류가 발생했습니다. (마이크 권한 및 네트워크 연결을 확인하세요)');
    }
  };

  const handleNextItem = () => {
    setCurrentIndex((prev) => (prev + 1) % SPEAK_ITEMS.length);
  };

  const handleRetry = () => {
    setPhase(2);
    setScoreResult(null);
    setScoreDetail(null);
    stopTriggeredRef.current = false;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const isCurrentCardAdvancedUnlocked = (successCounts[currentItem.id] || 0) >= 3;

  return (
    <div className={styles.container}>
      {/* Advanced mode switch panel */}
      <div className={styles.advancedOptionBar}>
        <span className={styles.headline}>🎙️ 스픽 챌린지</span>
        {isCurrentCardAdvancedUnlocked ? (
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={advancedMode} 
              onChange={(e) => setAdvancedMode(e.target.checked)} 
              className={styles.checkbox}
            />
            <span className={styles.advancedBadgeUnlocked}>Advanced 모드 On 🔥</span>
          </label>
        ) : (
          <span className={styles.advancedBadgeLocked}>🔒 Advanced 해금 대기 ({successCounts[currentItem.id] || 0}/3회 성공)</span>
        )}
      </div>

      <div className={styles.playerArea}>
        <video
          ref={videoRef}
          src={currentItem.videoUrl}
          className={styles.video}
          muted
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
        />

        {/* Video captions */}
        {phase === 1 && (
          <div className={styles.subtitleBox}>
            <span className={styles.speakerTag}>{currentItem.playerName}</span>
            <p className={styles.subtextEn}>{currentItem.targetEn}</p>
          </div>
        )}

        {/* Normal mode vs Advanced mode layout during Stop */}
        {phase === 2 && !isPlaying && !isRecording && !isAnalyzing && !scoreResult && (
          <div className={styles.blankOverlay}>
            <p className={styles.instructions}>
              {advancedMode ? '이 축구 상황에서 뭐라고 소리쳐야 할까요?' : `선수 대신 큰 소리로 외쳐주세요!`}
            </p>
            {!advancedMode && (
              <p className={styles.promptEnShadow}>
                {currentItem.targetEn.replace(/[a-zA-Z]/g, '_')}
              </p>
            )}
            <p className={styles.translationKr}>{currentItem.promptKr}</p>
          </div>
        )}

        {/* Micro-animations and recording controls */}
        {isRecording && (
          <div className={styles.recordingOverlay}>
            <div className={styles.pulseWave}></div>
            <div className={styles.micCircle}>
              <span className={styles.timer}>{recordingTimer}s</span>
            </div>
            <p className={styles.recordingLabel}>말하세요! 훈련장에 있는 것처럼 소리치세요!</p>
          </div>
        )}

        {/* Whisper Analyzing Loader */}
        {isAnalyzing && (
          <div className={styles.analyzingOverlay}>
            <div className={styles.spinner}></div>
            <p className={styles.analyzingLabel}>AI가 발음과 성량을 분석하고 있습니다...</p>
          </div>
        )}

        {/* ✅/❌ Result Layer */}
        {scoreResult && (
          <div className={`${styles.resultOverlay} ${scoreResult === 'success' ? styles.success : styles.failed}`}>
            <div className={styles.resultBadge}>
              {scoreResult === 'success' ? '✅' : '❌'}
            </div>
            <p className={styles.resultText}>
              {scoreResult === 'success' ? 'World Class! 통과!' : '정확하지 않습니다! 다시 시도하세요.'}
            </p>
            {scoreDetail && (
              <div className={styles.transcriptBox}>
                <span className={styles.transTitle}>내 발음:</span>
                <p className={styles.transText}>"{scoreDetail.transcript || '(소리 감지 안됨)'}"</p>
                <span className={styles.scoreVal}>정확도 OVR: {scoreDetail.score}점</span>
              </div>
            )}
            {scoreResult === 'failed' && (
              <button className={styles.retryBtn} onClick={handleRetry}>다시 도전하기</button>
            )}
          </div>
        )}
      </div>

      {/* Manual Skip or Next Controls */}
      <div className={styles.controlPanel}>
        <div className={styles.itemMeta}>
          <span>{currentIndex + 1} / {SPEAK_ITEMS.length}</span>
          <button className={styles.skipBtn} onClick={handleNextItem}>다음 카드 ➔</button>
        </div>
      </div>
    </div>
  );
}
