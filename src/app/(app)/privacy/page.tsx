import Head from 'next/head';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white font-sans antialiased">
      <Head>
        <title>개인정보처리방침 | TAL</title>
      </Head>

      <header className="sticky top-0 z-50 bg-[#0A0E1A]/90 backdrop-blur border-b border-[#1B2B4B]">
        <div className="max-w-[640px] mx-auto">
          <div className="flex items-center px-5 h-12">
            <a href="/ebook" className="font-black text-white text-sm">TAL</a>
            <span className="text-[#B0BEC5] text-xs ml-4">개인정보처리방침</span>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 py-10">
        <h1 className="text-3xl font-bold mb-8">개인정보처리방침</h1>
        
        <section className="space-y-6 text-sm text-[#B0BEC5] leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">1. 수집하는 개인정보 항목</h2>
            <p>TAL(이하 '회사')은(는) 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>필수항목: 이름, 이메일 주소, 서비스 이용 역할(선수, 학부모, 지도자 등)</li>
              <li>자동수집항목: 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2">2. 개인정보의 수집 및 이용목적</h2>
            <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>TAL 학습 자료(PDF 등) 제공 및 앱 안내</li>
              <li>신규 서비스(제품) 개발 및 맞춤 서비스 제공</li>
              <li>이벤트 및 광고성 정보 제공 및 참여기회 제공</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2">3. 개인정보의 보유 및 이용기간</h2>
            <p>원칙적으로, 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>보존 항목: 이름, 이메일 주소</li>
              <li>보존 근거: 서비스 이용 종료 시까지 또는 이용자의 삭제 요청 시까지</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2">4. 개인정보의 파기절차 및 방법</h2>
            <p>이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다.</p>
            <p className="mt-2">저장된 개인정보 삭제를 원하시면 tal.english.up@gmail.com으로 문의하세요.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2">
              5. YouTube API 서비스 이용
            </h2>
            <p>
              TAL은 Google이 제공하는 YouTube API Services를 사용하여 학습 영상을
              제공합니다. YouTube API 이용과 관련하여 아래 Google 정책이 함께 적용됩니다.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  Google 개인정보처리방침
                </a>
              </li>
              <li>
                <a
                  href="https://security.google.com/settings/security/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  Google 보안 설정 (API 액세스 관리)
                </a>
              </li>
              <li>
                YouTube 서비스 약관:&nbsp;
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  https://www.youtube.com/t/terms
                </a>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="px-5 py-10 bg-[#0A0E1A] border-t border-[#1B2B4B] mt-10">
        <div className="max-w-[640px] mx-auto">
          <p className="text-sm font-black text-white mb-1">TAL</p>
          <p className="text-xs text-[#546E7A] mb-6">Performance Tool for Football Players</p>
          <p className="text-xs text-[#546E7A] mt-4">© 2026 TAL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
