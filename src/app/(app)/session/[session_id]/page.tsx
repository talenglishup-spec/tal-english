'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabase } from '@/utils/supabase';
import STTRecorder from '@/components/STTRecorder';
import ScoreDisplay from '@/components/ScoreDisplay';
import ExpressionCard from '@/components/ExpressionCard';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const session_id = params.session_id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  
  // Parse session_id (e.g., S1_D01_Callplay)
  // S1 -> Step 1, D01 -> Day 1, Callplay -> Module
  const parts = session_id ? session_id.split('_') : [];
  const stepMatch = parts[0]?.match(/S(\d+)/);
  const dayMatch = parts[1]?.match(/D(\d+)/);
  
  const stepNumber = stepMatch ? stepMatch[1] : '?';
  const dayNumber = dayMatch ? dayMatch[1] : '?';
  const moduleName = parts[2] || 'Unknown';

  const [scoreResult, setScoreResult] = useState<{ score: number; transcript: string } | null>(null);

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        // Spec: 비로그인 -> /register 리다이렉트 (쿼리에 session_id 보존)
        if (!session) {
          router.push(`/register?redirect=/session/${session_id}`);
          return;
        }

        const dayNum = parseInt(dayNumber, 10);

        // Subscription check for Day 4+
        if (!isNaN(dayNum) && dayNum > 3) {
          const { checkSubscription } = await import('@/lib/subscription');
          const sub = await checkSubscription(session.user.id);
          if (!sub.isActive) {
            router.push('/paywall');
            return;
          }
        }

        // Mocking curriculum check for now
        // For Day 1, we assume it's ready, else we show "준비 중입니다"
        // Update: Let's assume all days are ready if they pass the subscription check
        setIsReady(true);
      } catch (error) {
        console.error('Session load error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuthAndLoad();
  }, [session_id, dayNumber, router]);

  const handleScore = (result: { score: number; transcript: string }) => {
    setScoreResult(result);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">준비 중입니다</h1>
        <p className="text-gray-500">Day {dayNumber} 콘텐츠는 아직 준비되지 않았습니다.</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-8 px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  // Placeholder data for Task B shell
  const placeholderExpression = {
    lcode: `L1-${dayNumber.padStart(2, '0')}`,
    english: "Mine!",
    korean: "내 공!",
    situation: "볼 경합 시 소유권 주장",
    pronunciationHint: "마인!"
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 tracking-tight">Day {dayNumber}</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-600">Step {stepNumber}</span>
          <span className="text-gray-300">|</span>
          <span className="text-blue-500 font-semibold">{moduleName}</span>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto p-6 flex flex-col gap-8">
        
        <ExpressionCard 
          {...placeholderExpression}
        />

        <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-4">
          <STTRecorder 
            answer={placeholderExpression.english}
            onScore={handleScore}
          />
          
          <ScoreDisplay 
            score={scoreResult ? scoreResult.score : null}
            transcript={scoreResult ? scoreResult.transcript : undefined}
            answer={placeholderExpression.english}
          />
        </div>

      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100 flex justify-center">
        <div className="w-full max-w-md">
          <button 
            disabled={!scoreResult}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              scoreResult 
                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            다음
          </button>
        </div>
      </footer>
    </div>
  );
}
