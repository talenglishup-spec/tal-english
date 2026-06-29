'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './DailyWorkout.module.css';

interface DailyWorkoutProps {
  streak: number;
  updateStreak: (newStreak: number) => void;
  updateXp: (amount: number) => void;
  addPieces: (cardId: string, amount: number) => void;
  roleModel: string;
}

const DAILY_EXPRESSIONS = [
  {
    stage: '훈련장 🏃‍♂️',
    targetEn: "Keep the intensity high!",
    promptKr: "훈련 강도를 높게 유지하자!",
    hint: "Keep the int... high!",
  },
  {
    stage: '라커룸 🗣️',
    targetEn: "React quicker on the transition!",
    promptKr: "공수 전환 시 더 빠르게 반응해!",
    hint: "React qui... on the transition!",
  },
  {
    stage: '경기장 ⚽',
    targetEn: "Feed me the ball!",
    promptKr: "나한테 패스 찔러줘!",
    hint: "Fe... me the ball!",
  },
  {
    stage: '인터뷰 🎤',
    targetEn: "We showed great character.",
    promptKr: "우리는 엄청난 투지를 보여주었습니다.",
    hint: "We showed gr... character.",
  }
];

export default function DailyWorkout({ streak, updateStreak, updateXp, addPieces, roleModel }: DailyWorkoutProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0 ~ 3
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attemptCount, setAttemptCount] = useState<number[]>([0, 0, 0, 0]);
  const [stepPassed, setStepPassed] = useState<boolean[]>([false, false, false, false]);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [scoreDetail, setScoreDetail] = useState<{ score: number; transcript: string } | null>(null);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentExpr = DAILY_EXPRESSIONS[currentStep];

  useEffect(() => {
    // Check if user already finished today from LocalStorage
    const lastDoneDate = localStorage.getItem('tal_demo_daily_last_date');
    const today = new Date().toDateString();
    if (lastDoneDate === today) {
      setHasCompletedToday(true);
    }
  }, []);

  const playTTS = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentExpr.targetEn);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
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

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        submitAudio(audioBlob);
      };

      setRecordingTimer(4);
      setIsRecording(true);
      mediaRecorder.start();

      timerIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (e) {
      alert('마이크 권한을 확인해주세요.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const submitAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    setScoreDetail(null);

    // Track attempt count
    const newAttempts = [...attemptCount];
    newAttempts[currentStep] += 1;
    setAttemptCount(newAttempts);

    const formData = new FormData();
    formData.append('file', blob, 'daily-attempt.webm');
    formData.append('target_en', currentExpr.targetEn);

    try {
      const res = await fetch('/api/learn-modes-demo/score', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setIsAnalyzing(false);

      setScoreDetail(data);

      if (data.score >= 80) {
        const nextPassed = [...stepPassed];
        nextPassed[currentStep] = true;
        setStepPassed(nextPassed);
      }
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      alert('채점 중 서버 에러가 발생했습니다.');
    }
  };

  const handleNextStep = () => {
    setScoreDetail(null);
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Finished all 4 steps!
      handleCompleteWorkout();
    }
  };

  const handleCompleteWorkout = () => {
    // Reward calculations
    const isPerfect = attemptCount.every(attempts => attempts === 1);
    let finalReward = 100; // Base XP
    let message = '오늘의 데일리 4단계 전술 훈련 완료! 🎉\nXP +100 획득!';

    if (isPerfect) {
      finalReward += 30; // Perfect bonus
      message += '\n첫 시도 올패스 보너스! XP +30 추가!';
    }

    // Streak logic
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastDoneDate = localStorage.getItem('tal_demo_daily_last_date');

    let nextStreak = streak;
    if (lastDoneDate === yesterday) {
      nextStreak += 1;
    } else if (lastDoneDate !== today) {
      nextStreak = 1;
    }
    updateStreak(nextStreak);

    // Streak XP reward
    const streakReward = 50;
    finalReward += streakReward;
    message += `\n${nextStreak}일 연속 훈련 보너스! XP +${streakReward} 추가!`;

    // Add Player Card Pieces
    addPieces(roleModel, 1);
    message += `\n롤 모델 선수 카드 조각 +1 획득!`;

    updateXp(finalReward);
    localStorage.setItem('tal_demo_daily_last_date', today);
    setHasCompletedToday(true);
    alert(message);
  };

  if (hasCompletedToday) {
    return (
      <div className={styles.container}>
        <div className={styles.completeCard}>
          <div className={styles.trophy}>🔥</div>
          <h3>오늘의 전술 완료!</h3>
          <p className={styles.completeSub}>내일 아침 새로운 전술 카드로 찾아옵니다.</p>
          
          <div className={styles.rewardSummary}>
            <div className={styles.rewardItem}>
              <span>XP</span>
              <strong>완료 보상 지급됨</strong>
            </div>
            <div className={styles.rewardItem}>
              <span>Streak</span>
              <strong>{streak}일 연속 학습 중</strong>
            </div>
            <div className={styles.rewardItem}>
              <span>조각</span>
              <strong>카드 조각 +1 조각</strong>
            </div>
          </div>
          
          <button 
            className={styles.resetBtn} 
            onClick={() => {
              localStorage.removeItem('tal_demo_daily_last_date');
              setHasCompletedToday(false);
              setCurrentStep(0);
              setStepPassed([false, false, false, false]);
              setAttemptCount([0, 0, 0, 0]);
            }}
          >
            시뮬레이션 초기화 (다시 학습해보기)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        {DAILY_EXPRESSIONS.map((exp, idx) => (
          <div 
            key={idx} 
            className={`${styles.progressSegment} ${idx === currentStep ? styles.active : idx < currentStep ? styles.passed : ''}`}
          >
            <span className={styles.stepDot}></span>
            <span className={styles.stepLabel}>{exp.stage.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      <div className={styles.cardArea}>
        <div className={styles.stageTitle}>
          <span>{currentStep + 1}/4 단계</span>
          <h2>{currentExpr.stage}</h2>
        </div>

        <div className={styles.promptBox}>
          <p className={styles.promptKr}>"{currentExpr.promptKr}"</p>
          <p className={styles.hintEn}>Hint: {currentExpr.hint}</p>
        </div>

        <div className={styles.actionSection}>
          <button className={styles.audioBtn} onClick={playTTS}>
            🔊 모범 발음 듣기
          </button>

          {isRecording ? (
            <div className={styles.recordingBox}>
              <div className={styles.pulse}>🔴</div>
              <span>녹음 중... {recordingTimer}s</span>
              <button className={styles.stopBtn} onClick={stopRecording}>정지</button>
            </div>
          ) : isAnalyzing ? (
            <div className={styles.analyzingBox}>
              <div className={styles.spinner}></div>
              <span>AI 채점 분석 중...</span>
            </div>
          ) : (
            <button 
              className={`${styles.recordBtn} ${stepPassed[currentStep] ? styles.passed : ''}`} 
              onClick={startRecording}
            >
              🎤 {stepPassed[currentStep] ? '다시 따라 말하기' : '따라 말하기 시작'}
            </button>
          )}
        </div>

        {scoreDetail && (
          <div className={`${styles.feedbackCard} ${stepPassed[currentStep] ? styles.success : styles.failed}`}>
            <h4>{stepPassed[currentStep] ? 'World Class! ✅' : '정확하지 않습니다 ❌'}</h4>
            <p className={styles.feedbackTranscript}>인식된 발화: "{scoreDetail.transcript || '없음'}"</p>
            <p className={styles.feedbackDetail}>OVR 점수: {scoreDetail.score}점 (80점 이상 패스)</p>
          </div>
        )}

        {stepPassed[currentStep] && (
          <button className={styles.nextBtn} onClick={handleNextStep}>
            {currentStep < 3 ? '다음 전술 단계로 ➔' : '데일리 전술 완료하기 🏆'}
          </button>
        )}
      </div>
    </div>
  );
}
