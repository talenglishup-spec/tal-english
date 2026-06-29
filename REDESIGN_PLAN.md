# TAL App Football Trainer Mode Redesign Plan

본 문서는 **TAL 앱 학습 모드 및 컬렉션 레이어 설계도 v1**에 명시된 요구사항을 바탕으로, 데모 페이지(`learn-modes-demo`)를 구현하며 검증된 설계 기법과 기존 어플리케이션 구조를 프로덕션 환경에 반영하기 위한 상세 설계 계획서입니다.

---

## 1. 아키텍처 개요 및 데이터 흐름

TAL 학습 모드 v1은 사용자가 인스타그램 릴스/쇼츠 형태로 무의식적인 반복 학습을 경험하는 **쇼츠 모드**, 능동적으로 발화하고 평가를 받는 **스픽 모드**, 매일 고정 루틴을 클리어하는 **하루 끝내기**, 그리고 동기부여 요소인 **컬렉션(선수 카드)**이 긴밀히 얽혀 있습니다.

이를 위해 **Google Sheets(정적 콘텐츠 데이터베이스)**와 **Supabase(실시간 사용자 학습 데이터베이스)**, 그리고 **OpenAI Whisper API(음성 분석 엔진)**가 결합된 3-tier 하이브리드 백엔드 구조로 마이그레이션합니다.

```
                  ┌──────────────────────────────┐
                  │      Next.js Web Client      │
                  └──────────────┬───────────────┘
                                 │ HTTP POST/GET
                                 ▼
                  ┌──────────────────────────────┐
                  │    Next.js Route Handlers    │
                  └──────┬───────────────┬───────┘
                         │               │
      ┌──────────────────┴──┐         ┌──┴──────────────────┐
      │ Google Sheets API   │         │ Supabase Client SDK │
      │ (학습 표현 메타데이터)│         │ (XP, Streak, 카드)  │
      └─────────────────────┘         └─────────────────────┘
```

---

## 2. 데이터베이스 및 메타데이터 스키마 설계

### 2-1. Google Sheets - `Items` 시트 메타데이터 보완
쇼츠의 반복 재생 구간 및 뉘앙스 팝업 콘텐츠를 정의하기 위해 스프레드시트의 `Items` 시트에 아래의 열을 추가합니다.

| 컬럼명 | 데이터 타입 | 설명 | 예시 |
| :--- | :--- | :--- | :--- |
| **item_id** | String (PK) | 표현 카드 고유 식별값 | `sonny-match-01` |
| **subtype** | String | 상황 필터 (`training`, `match`, `locker`, `interview`) | `match` |
| **position_tag** | String | 포지션 필터 (`FW`, `MF`, `DF`, `GK`, `ALL`) | `FW` |
| **highlight_start_sec** | Float | 0.7x / 0.5x 속도로 루프할 핵심 표현의 시작점 (초) | `1.50` |
| **highlight_end_sec** | Float | 0.7x / 0.5x 속도로 루프할 핵심 표현의 종료점 (초) | `4.20` |
| **nuance_desc** | Text | 설명 팝업 내 뉘앙스 한 줄 설명 | `역습 상황에서 주력을 활용할 때 소리칩니다.` |
| **similar_expressions**| String (JSON) | 유사 영어 표현 목록 (1~2개) | `["Send it through!", "Go wide!"]` |
| **audio_explanation_url**| String | 표현 뉘앙스 오디오 해설 URL (10~20초 분량) | `https://supabase.co/storage/.../explain.mp3` |

### 2-2. Supabase DB - 프로덕션 테이블 정의
게이미피케이션 점수와 사용자 개인 수집 현황은 트랜잭션이 보장되고 인덱싱이 효율적인 Supabase PostgreSQL에서 직접 관리합니다.

#### ① `player_status` (플레이어 레벨 및 연속 학습 정보)
```sql
CREATE TABLE player_status (
    player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp INTEGER DEFAULT 0 NOT NULL,
    streak_days INTEGER DEFAULT 0 NOT NULL,
    last_completed_date DATE,
    selected_role_model VARCHAR(50) DEFAULT 'sonny',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

#### ② `player_collection` (선수 카드 조각 현황)
```sql
CREATE TABLE player_collection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_card_id VARCHAR(50) NOT NULL, -- 'sonny', 'haaland', 'pep' 등
    collected_pieces INTEGER DEFAULT 0 NOT NULL, -- 0 ~ 30
    is_unlocked BOOLEAN DEFAULT FALSE NOT NULL, -- 30조각 달성 시 TRUE
    unlocked_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(player_id, player_card_id)
);
```

#### ③ `speak_attempts_log` (스픽 모드 통과 횟수 트래킹 - Advanced 모드 해금용)
```sql
CREATE TABLE speak_attempts_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    success_count INTEGER DEFAULT 0 NOT NULL, -- ✅ 통과한 횟수
    attempt_count INTEGER DEFAULT 0 NOT NULL, -- 총 시도 횟수
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(player_id, item_id)
);
```

---

## 3. 학습 모드별 상세 구현 세부사항

### 3-1. 쇼츠 모드 (Shorts Mode)
* **세로 9:16 비디오 스냅 레이아웃**: Tailwind CSS와 `Framer Motion`을 조합하거나, 모바일 네이티브 스크롤 스냅을 활용해 부드러운 스와이프를 보장합니다.
  ```css
  .shortsContainer {
    scroll-snap-type: y mandatory;
    overflow-y: scroll;
    height: 100vh;
  }
  .shortsCard {
    scroll-snap-align: start;
    height: 100vh;
  }
  ```
* **3단계 재생 메커니즘**:
  - **1회차**: `video.playbackRate = 1.0;`으로 전체 영상을 정상 재생합니다.
  - **2회차**: 전체 영상이 끝난 후(또는 `timeupdate` 감지 시) `currentTime`을 `highlight_start_sec`로 되돌리고, 해당 구간 동안 `playbackRate = 0.7;`을 설정합니다.
  - **3회차**: 2회차 구간 루프 종료 시 다시 `highlight_start_sec`로 복원하며 `playbackRate = 0.5;`로 느리게 억양/리듬을 체득하도록 유도합니다.
  - **종료**: 3회차가 끝나면 클라이언트 애니메이션 모듈이 감지하여 다음 쇼츠 카드로 스냅 스크롤 전환을 자동 호출합니다.
* **설명 팝업**: ℹ️ 버튼 터치 시 영상 소리를 음소거(`video.muted = true`)하고, 오디오 가이드를 Web Speech API 또는 기녹음된 `audio_explanation_url`를 활용해 재생합니다.

### 3-2. 스픽 모드 (Speak Mode)
* **2회차 자동 정지**: 영상이 1회 완독된 후, 2회차에서 재생 헤드(`currentTime`)가 `highlight_start_sec` 직전(약 0.1초 전)에 도달하면 `video.pause()`를 걸어 일시정지시킵니다.
* **STT 채점 파이프라인**: 
  1. 정지 즉시 마이크 모듈 활성화 및 화면에 3~5초 Circular Progress 타이머 렌더링.
  2. 사용자가 녹음 완료 시 Blob 데이터를 Multipart Form에 실어 Next.js API `/api/train/speak-score`로 전송.
  3. Whisper API가 영문 발화를 전사(Transcription)하면, 기존 Levenshtein Distance 알고리즘을 사용해 정확도를 계산하고 80점 이상일 경우 통과(✅) 처리.
  4. 정답 피드백이나 설명은 일절 노출하지 않고 ❌일 시 오직 '다시 도전' 유도.
* **Advanced 모드 해금**:
  - `speak_attempts_log` 테이블에서 `success_count`가 3 이상인 경우에 한해 UI 상에서 Advanced 스위치를 오픈합니다.
  - Advanced 모드가 켜진 경우, 자막 가이드 라인과 멈춤 지점 경고 타이머를 삭제하고, 영상 도중 상황이 닥쳤을 때 자동으로 정지하면 사용자가 문맥을 스스로 파악해 발화하도록 고난이도 UX를 제공합니다.

### 3-3. 하루 끝내기 (One-Day Expression)
* **고정 4단계 시퀀스**:
  - 훈련장 ➔ 라커룸 ➔ 경기장 ➔ 인터뷰 단계가 고유 상태 객체(State)로 연결되어 사용자가 임의로 다음 단계로 스킵하지 못하도록 보장합니다.
* **게이미피케이션 가산 로직 (`/api/daily/workout-complete`)**:
  - 사용자가 하루에 4스텝을 전부 클리어하면 API를 통해 데이터베이스 트랜잭션을 엽니다.
  - 당일 날짜 `yyyy-mm-dd` 기준으로 중복 완료를 검사하여 어뷰징을 예방합니다.
  - 연속 완료일(Streak) 계산: 마지막 완료일이 '어제'라면 `streak_days` + 1, 공백이 크다면 1로 리셋.
  - 완료 시 `+100 XP` 기본 지급, Streak 일수에 비례해 보너스 지급, 첫 시도 올패스 시 `+30 XP` 보너스를 부여합니다.
  - 롤 모델로 설정된 선수의 카드 조각 `player_collection.collected_pieces`를 +1 증가시킵니다.

### 3-4. 컬렉션 (Collection Layer)
* **카드 수집 및 조각화**:
  - 한 장의 카드를 완성하기 위해 30개의 조각(30일 완료 조건)이 필요합니다.
  - 조각 수에 따라 진행률 게이지 바가 채워지며, 미해금된 상태에서는 선수 이미지에 CSS Silhoutte 필터를 씌우고 카드 컬러만 가시화합니다.
  ```css
  .silhouette {
    filter: brightness(0) contrast(1.2);
    opacity: 0.6;
  }
  ```
  - 30조각이 충전되는 순간 해금 이벤트와 함께 실루엣이 페이드아웃 되며 실제 카드 디자인과 선수 오피셜 대표 영문 표현이 활성화됩니다.
* **스쿼드룸 (Squad Room)**:
  - 사용자가 앱 진입 시 선택한 롤 모델 선수가 메인 집중 타겟으로 세팅되며, 해금 완료 후에는 보관함 리스트에서 자유롭게 다음 롤 모델 선수를 선택하여 수집을 시작하도록 UI를 제공합니다.

---

## 4. AI 영상 에셋 구축 및 운영 자동화 계획 (핵심 병목 해결)

경기 영상의 저작권 문제 회피 및 영상 제작 비용 절감을 위해 AI 비디오 생성 엔진(Sora, Kling AI, Runway Gen-3)을 활용하여 축구 모션 중심의 9:16 비디오 소스를 수급하며, 이를 위해 CMS(콘텐츠 관리 시스템)와 메타데이터 추출 작업을 자동화합니다.

```
       [ Sora / Kling / Runway ] (9:16 축구 모션 영상 생성)
                   │
                   ▼
      [ CLI 스크립트 기반 자동 가공 ]
       - 1. OpenAI Whisper: 영어 발화 스크립트 텍스트 추출 및 단어별 정확한 타임코드 매칭
       - 2. FFmpeg: 최적화 압축 (HEVC/H.264 MP4, WebM 포맷 추출)
                   │
                   ▼
       [ Supabase Storage 업로드 ] ➔ [ Google Sheets 메타데이터 등록 ]
```

* **Whisper Word-Level Timestamp 자동화**:
  - 운영 어드민이 영상 소스를 수동 등록할 때, Whisper API의 `timestamp_granularities: ["word"]`를 활성화하여 영단어가 발화되는 밀리초 단위 타임코드를 자동 추출합니다.
  - 이를 통해 핵심 구간(`highlight_start_sec`, `highlight_end_sec`) 메타데이터가 스프레딧시트에 자동으로 등록되도록 연동 스크립트를 배포하여 리소스를 축소합니다.
