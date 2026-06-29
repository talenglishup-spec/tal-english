'use client';

import React, { useState } from 'react';

const faqs = [
  {
    question: "영어를 전혀 못해도 할 수 있나요?",
    answer: "네. TAL은 문법 설명이 없습니다. '이 상황에서 이 말'을 반복 발화하는 방식입니다. Day 1 첫 표현은 'Mine!' — 한 단어입니다."
  },
  {
    question: "앱은 어디서 다운받나요?",
    answer: "TAL은 웹 앱입니다. talroi.com 에 접속하면 바로 시작할 수 있습니다. 별도 설치 없이 모바일 브라우저에서 동작합니다."
  },
  {
    question: "하루에 얼마나 해야 하나요?",
    answer: "하루 7분이 기준입니다. 세션 하나가 7분 내외로 설계되어 있습니다. 짧더라도 매일 하는 것이 핵심입니다."
  },
  {
    question: "유소년 선수도 할 수 있나요?",
    answer: "TAL의 핵심 타겟이 15~19세 유소년 선수입니다. 모든 콘텐츠는 축구 실전 상황 기반이라 나이와 무관하게 바로 적용됩니다."
  },
  {
    question: "팀 전체가 함께 할 수 있나요?",
    answer: "팀 플랜이 있습니다. 팀 코드로 가입하면 팀 랭킹보드가 활성화됩니다. 코치 대시보드에서 팀원 진도 확인도 가능합니다. 별도 문의 주세요."
  }
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 px-6 w-full max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-black mb-8 text-center text-white">자주 묻는 질문</h2>
      <div className="flex flex-col gap-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="bg-landingCardBg border border-landingNavy2 rounded-lg overflow-hidden transition-all duration-300">
              <button 
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between p-6 text-left cursor-pointer focus:outline-none"
              >
                <span className="font-semibold text-lg text-white">{faq.question}</span>
                <span className={`transform transition-transform duration-300 text-landingGreen ${isOpen ? 'rotate-45' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-6 pt-0 text-landingGray leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
