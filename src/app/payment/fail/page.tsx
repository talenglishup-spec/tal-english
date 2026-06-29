'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || '알 수 없는 오류';

  return (
    <div className="min-h-screen bg-[#070e17] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0F1E30] border border-[#1B2B4B] rounded-2xl p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold mb-4 text-red-500">결제 실패</h1>
        <p className="text-gray-300 mb-6">
          결제 처리 중 문제가 발생했습니다.
        </p>
        
        <div className="bg-[#0c1622] rounded-xl p-4 text-sm text-gray-400 text-left mb-8 border border-gray-800">
          오류 사유: {reason}
        </div>

        <Link 
          href="/paywall" 
          className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-all"
        >
          다시 시도하기
        </Link>
      </div>
    </div>
  );
}
