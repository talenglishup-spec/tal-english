'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { getSupabase } from '@/utils/supabase';

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'pro';
  const period = searchParams.get('period') || 'monthly';
  
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    async function init() {
      if (initialized.current) return;
      initialized.current = true;

      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/register?redirect=/payment');
          return;
        }

        const pid = session.user.id;
        setPlayerId(pid);

        // 1. 결제 준비 API 호출 (orderId 생성 및 시트 기록)
        const prepRes = await fetch('/api/payment/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, period })
        });

        if (!prepRes.ok) {
          throw new Error('Failed to prepare payment');
        }

        const { orderId, amount, orderName } = await prepRes.json();

        // 2. 토스 로드 (기본 샌드박스 클라이언트 키 폴백 적용)
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_qbgFCmKoOrpe7y59M4z3rQn2Vgwj';
        const tossPayments = await loadTossPayments(clientKey);

        let paymentObj: any = tossPayments;
        if (typeof (tossPayments as any).payment === 'function') {
           paymentObj = (tossPayments as any).payment({ customerKey: pid });
        }

        const successUrl = window.location.origin + '/api/payment/confirm';
        const failUrl = window.location.origin + '/payment/fail';

        // 3. 결제창 요청 기동
        await paymentObj.requestPayment('카드', {
          amount,
          orderId,
          orderName,
          successUrl,
          failUrl,
          customerEmail: session.user.email,
        });

      } catch (error) {
        console.error('Payment initialization error:', error);
        alert('결제 초기화 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [plan, period, router]);

  return (
    <div className="min-h-screen bg-[#070e17] flex items-center justify-center text-white">
      {loading ? (
        <div className="text-xl font-bold animate-pulse">결제창을 불러오는 중입니다...</div>
      ) : (
        <div className="text-xl font-bold">결제 진행 중...</div>
      )}
    </div>
  );
}
