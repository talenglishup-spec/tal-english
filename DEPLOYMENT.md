# Football English Trainer - Vercel 배포 가이드

이 가이드를 따라 Vercel에 앱을 배포하세요. 배포를 완료하면 모바일 기기에서도 접속할 수 있으며, 마이크 기능이 정상적으로 작동합니다. (HTTPS 환경 필요)

## 사전 준비 사항
- [Vercel](https://vercel.com) 계정
- [GitHub](https://github.com) 계정

## 1단계: GitHub에 코드 올리기 (푸시)
1. GitHub에서 새로운 저장소(Repository)를 만드세요 (예: `football-trainer`).
2. 프로젝트 폴더(`football-trainer`)에서 터미널을 열고 아래 명령어를 순서대로 입력하세요:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<사용자이름>/football-trainer.git
   git push -u origin main
   ```
   *(`<사용자이름>` 부분은 본인의 GitHub 아이디로 바꿔주세요)*

## 2단계: Vercel로 프로젝트 가져오기
1. [Vercel 대시보드](https://vercel.com/dashboard)로 이동합니다.
2. **"Add New..."** 버튼을 누르고 **"Project"**를 선택합니다.
3. 방금 올린 `football-trainer` 저장소를 찾아 **"Import"**를 클릭합니다.

## 3단계: 환경 변수 설정 (가장 중요! ⭐)
**주의**: API 키가 없으면 앱이 작동하지 않습니다. 로컬의 `.env.local` 내용을 그대로 옮겨야 합니다.

1. "Configure Project" 화면에서 **"Environment Variables"** 섹션을 펼칩니다.
2. 아래 변수들을 하나씩 추가해주세요 (값은 `.env.local` 파일에서 복사해서 붙여넣으세요):

| 키 (Key) | 값 설명 (Value) |
|-----|-------------------|
| `OPENAI_API_KEY` | OpenAI API 키 (`sk-`로 시작하는 값) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | Supabase Anon Key |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 서비스 계정 이메일 (예: `tal-786@...`) |
| `GOOGLE_PRIVATE_KEY` | **아래 주의사항 참고!** |
| `GOOGLE_SHEET_ID` | 구글 시트 URL에 있는 ID |

> **⚠️ GOOGLE_PRIVATE_KEY 입력 시 주의사항**:
> `.env.local`에 있는 키 값을 `-----BEGIN PRIVATE KEY-----` 부터 `-----END PRIVATE KEY-----` 까지 **전부** 복사해서 넣으세요. 줄바꿈 문자(`\n`)가 포함되어 있어도 Vercel이 알아서 처리해줍니다.

## 4단계: 배포 시작 (Deploy)
1. **"Deploy"** 버튼을 누릅니다.
2. 배포가 완료될 때까지 기다립니다 (보통 1~2분 소요).
3. 완료되면 축하 메시지와 함께 접속 가능한 URL (예: `https://football-trainer.vercel.app`)이 나옵니다.

## 5단계: 모바일에서 테스트 📱
1. 아이폰이나 갤럭시 등 스마트폰에서 Vercel URL로 접속합니다.
2. `/train` 페이지로 이동합니다 (또는 Start Training 버튼 클릭).
3. 마이크 아이콘을 누릅니다. 브라우저가 마이크 권한을 요청하면 **"허용"**을 누르세요.
4. 구글 시트(`Items` 탭) 내용을 수정하면 별도 배포 없이도 이 사이트에 즉시 반영됩니다!
