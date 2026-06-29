'use client';

import React, { useState, useEffect } from 'react';
import { getSupabase } from '@/utils/supabase';
import ShortsPlayer from '@/components/ShortsPlayer';
import XPToast from '@/components/XPToast';
import styles from './WorkoutPage.module.css';

interface ClipItem {
  clip_id: string;
  youtube_url: string;
  player_name: string;
  position_tag: string;
  subtype: string;
  target_phrase: string;
  nuance_desc: string;
  similar_expressions: string;
  speak_mode: boolean;
  pause_at: number;
}

export default function WorkoutPage() {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepSuccess, setStepSuccess] = useState<{ [step: number]: boolean }>({
    1: false, 2: false, 3: false, 4: false
  });
  
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [xpToastVisible, setXpToastVisible] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);

  const supabase = getSupabase();

  useEffect(() => {
    async function loadDrills() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setPlayerId(session.user.id);
        }

        const res = await fetch('/api/content/items?speak=1&limit=80');
        const data = await res.json();
        setClips(data.items || []);
      } catch (err) {
        console.error('[WorkoutPage] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDrills();
  }, [supabase]);

  const getClipForStep = (step: number): ClipItem | null => {
    if (clips.length === 0) return null;

    if (step === 1) {
      return clips.find(c => c.subtype === 'training' || c.subtype === 'tactical') || clips[0];
    } else if (step === 2) {
      return clips.find(c => c.subtype === 'signing' || c.subtype === 'first_day') || clips[1] || clips[0];
    } else if (step === 3) {
      return clips.find(c => c.subtype === 'post_match') || clips[2] || clips[0];
    } else if (step === 4) {
      return clips.find(c => c.subtype === 'press_conference') || clips[3] || clips[0];
    }
    return null;
  };

  const currentClip = getClipForStep(currentStep);

  const handleStepSuccess = (passed: boolean) => {
    if (passed) {
      setStepSuccess(prev => ({ ...prev, [currentStep]: true }));
    }
  };

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleWorkoutComplete = async () => {
    if (!stepSuccess[1] || !stepSuccess[2] || !stepSuccess[3] || !stepSuccess[4]) {
      alert('모든 4단계 훈련 코스를 성공(✓)해야 하루 끝내기를 완료할 수 있습니다!');
      return;
    }

    try {
      const res = await fetch('/api/daily/workout-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: currentClip ? currentClip.player_name : 'SONNY'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEarnedXp(data.xpGained);
          setXpToastVisible(true);
          setWorkoutComplete(true);
          setTimeout(() => {
            window.location.href = '/home';
          }, 2000);
        }
      }
    } catch (err) {
      console.error('[Workout Complete Error]:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>오늘의 4단계 훈련 루틴을 계획하고 있습니다...</p>
      </div>
    );
  }

  const stepsLabel = ['훈련장 ⚽', '라커룸 👕', '경기장 🏟️', '기자회견 🎤'];

  return (
    <div className={styles.container}>
      <XPToast 
        xp={earnedXp} 
        visible={xpToastVisible} 
        onClose={() => setXpToastVisible(false)} 
      />

      <header className={styles.header}>
        <h1 className={styles.title}>🔥 오늘의 훈련 루틴</h1>
        <p className={styles.subtitle}>4단계를 정복하여 오늘 하루를 끝마치세요!</p>
      </header>

      <section className={styles.indicatorSection}>
        <div className={styles.indicatorGrid}>
          {stepsLabel.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepSuccess[stepNum];
            const isCurrent = currentStep === stepNum;

            return (
              <div 
                key={label} 
                onClick={() => {
                  if (stepNum === 1 || stepSuccess[stepNum - 1] || stepNum <= currentStep) {
                    setCurrentStep(stepNum);
                  }
                }}
                className={styles.indicatorItem + (isCurrent ? ' ' + styles.indicatorCurrent : '') + (isCompleted ? ' ' + styles.indicatorCompleted : '')}
              >
                <span className={styles.indicatorCircle}>
                  {isCompleted ? '✓' : stepNum}
                </span>
                <span className={styles.indicatorText}>{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <main className={styles.feedScroll}>
        {currentClip ? (
          <div className={styles.playerWrapper}>
            <div className={styles.stepBadge}>
              STEP {currentStep} : {stepsLabel[currentStep - 1]}
            </div>

            <ShortsPlayer
              key={currentClip.clip_id + '-' + currentStep}
              clip={currentClip}
              isActive={true}
              onNext={handleNextStep}
              onPrev={handlePrevStep}
              isFirst={currentStep === 1}
              isLast={currentStep === 4}
              playerId={playerId}
            />

            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {stepSuccess[currentStep] ? (
                <div className={styles.successMessage}>
                  🎉 {currentStep}단계 훈련 통과! (다음 단계로 이동)
                </div>
              ) : (
                <div className={styles.waitingMessage}>
                  🎙️ 비디오 재생 도중 발음을 연습하여 훈련을 통과하세요.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
            <p>훈련에 필요한 콘텐츠 비디오가 시딩되지 않았습니다.</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        {currentStep === 4 && stepSuccess[1] && stepSuccess[2] && stepSuccess[3] && stepSuccess[4] ? (
          <button 
            type="button" 
            onClick={handleWorkoutComplete} 
            className={styles.btnComplete + (workoutComplete ? ' ' + styles.btnCompleteSuccess : '')}
            disabled={workoutComplete}
          >
            {workoutComplete ? '⚙️ 완료 정산 중...' : '🏆 오늘 하루 끝내기 완료'}
          </button>
        ) : (
          <div className={styles.drillStatusText}>
            모든 4단계를 완료하면 정산 단추가 가시화됩니다.
          </div>
        )}
      </footer>
    </div>
  );
}
