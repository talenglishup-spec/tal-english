'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

export default function PaywallPage() {
  const router = useRouter();

  const handleSubscribe = () => {
    router.push('/payment?plan=pro&period=monthly');
  };

  return (
    <div className="min-h-screen bg-[#070e17] text-white flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-md w-full space-y-8">
        
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300">
            Day 3까지 무료 체험 완료!
          </h1>
          <p className="text-gray-400">
            지금까지 <span className="text-white font-semibold">Mine!, Stay with him!, Don&apos;t dive in!</span> 등을 배웠습니다.
          </p>
        </div>

        <div className="bg-[#0c1622] border border-green-500/30 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(34,197,94,0.1)]">
          <p className="text-lg">
            Day 4부터는 <span className="text-green-400 font-bold">Hold the line!, Switch!, Drop!</span> 등 본격적인 전술 표현이 등장합니다.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            계속 훈련하려면 구독이 필요합니다.
          </p>
        </div>

        <div className="relative bg-[#0F1E30] border border-[#1B2B4B] rounded-2xl p-6 shadow-xl overflow-hidden mt-6">
          <div className="absolute top-0 right-0 bg-green-500 text-[#070e17] text-xs font-bold px-3 py-1 rounded-bl-lg">
            가장 많이 선택
          </div>
          
          <h2 className="text-2xl font-bold mb-2">TAL 프로</h2>
          
          <div className="flex items-center space-x-2 mb-4">
            <span className="line-through text-gray-500 text-sm">일반 축구 영어 과외 월 30만원</span>
          </div>
          
          <div className="mb-6 flex items-end">
            <span className="text-4xl font-extrabold text-white">₩19,900</span>
            <span className="text-gray-400 ml-2 mb-1">/ 월</span>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0" />
              <span className="text-sm text-gray-200">Day 1~40 전체 커리큘럼 무제한 접근</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0" />
              <span className="text-sm text-gray-200">AI STT 발화 채점 & 교정 피드백</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0" />
              <span className="text-sm text-gray-200">주간 훈련 리포트 발송</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0" />
              <span className="text-sm text-gray-200">신규 OnPitch 클립 자동 업데이트</span>
            </div>
          </div>

          <button
            onClick={handleSubscribe}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg"
          >
            지금 구독하기
          </button>
        </div>

      </div>
    </div>
  );
}
