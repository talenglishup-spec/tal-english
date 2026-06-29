'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="max-w-md w-full bg-[#0F1E30] border border-[#1B2B4B] rounded-2xl p-8 text-center shadow-xl">
      <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
      
      <h1 className="text-3xl font-bold mb-4">결제 완료!</h1>
      <p className="text-lg text-green-400 font-semibold mb-6">
        이제 피치 영어를 본격적으로 시작합니다.
      </p>

      <div className="bg-[#0c1622] rounded-xl p-4 text-sm text-gray-300 text-left mb-8 space-y-2 border border-gray-800">
        <div className="flex justify-between">
          <span className="text-gray-500">주문 번호</span>
          <span className="font-mono">{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">플랜</span>
          <span>TAL 프로</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-800">
          <span className="text-gray-500">다음 결제일</span>
          <span>한 달 후 자동 갱신</span>
        </div>
      </div>

      <Link 
        href="/home" 
        className="block w-full bg-green-500 hover:bg-green-400 text-[#070e17] font-bold py-4 rounded-xl transition-all"
      >
        Day 4 시작하기
      </Link>

      <p className="text-sm text-gray-500 mt-6">
        가입하신 이메일로 환영 메일과 영수증이 발송됩니다 (수 분 내).
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#070e17] text-white flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-xl font-bold animate-pulse">로딩 중...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
