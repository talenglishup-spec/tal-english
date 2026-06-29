'use client';

import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

interface CardData {
  id: string;
  title: string;
  situation: string;
  dialogues: { speaker: string; text: string; action: string }[];
  keyExpressions: { lCode: string; items: { text: string; meaning: string }[]; tier: string };
  nuanceTip: string;
  ctaText: string;
  ctaLink: string;
}

const CARDS: CardData[] = [
  // Prologue
  { 
    id: '22', 
    title: '후방 빌드업',
    situation: '수비수 또는 골키퍼가 공을 잡았다. 반사적으로 롱볼을 차려는 순간,\n감독이 또는 동료가 소리친다. 뒤에서부터 패스로 차분하게 빌드업을 시작하라는 지시다.\n막 롱볼을 차지 말고 뒤에서부터 패스로 풀어나와!',
    dialogues: [
      { speaker: '선수 A (감독 / CM)', text: 'Play out! Play out from the back! Don\'t just hoof it — build it!', action: '빌드업 지시' },
      { speaker: '선수 B (GK)', text: 'Okay! Short! Come on!', action: '수비수에게 숏 패스하며 빌드업 시작' }
    ],
    keyExpressions: {
      lCode: 'TC-C-12',
      tier: '3',
      items: [
        { text: 'Play out from the back.', meaning: '후방에서부터 빌드업해.' }
      ]
    },
    nuanceTip: '"Hoof it"은 무작정 멀리 차는 롱볼 슬랭이다.\n"Play out from the back"은 수비에서부터 패스 조직을 만들어 올라오라는 전술 철학이다.\n현대 축구의 기본 빌드업 지시어로, 라커룸과 경기장에서 모두 자주 들린다.',
    ctaText: '앱에서 훈련하기 →',
    ctaLink: 'tal://session/CP22_Practice'
  },
  {
    id: '23',
    title: '맨마킹',
    situation: '코너킥 또는 세트피스 수비 상황이다. 상대 선수들의 헤딩 능력이 좋아서\n지역 수비로는 불리하다고 판단한 캡틴 또는 감독이 맨투맨 수비로 전환을 선언한다.\n코너킥이 차지기 직전의 순간이다.',
    dialogues: [
      { speaker: '선수 A (캡틴 / 감독)', text: 'Right — we\'re going man for man. Everyone picks up a man — no zones.', action: '맨투맨 수비 전환 선언' },
      { speaker: '선수 B (선수들)', text: 'Man for man! Who\'s on number nine?', action: '확인하며 즉시 배치' }
    ],
    keyExpressions: {
      lCode: 'TC-C-13',
      tier: '3',
      items: [
        { text: 'Going man for man.', meaning: '맨투맨으로 간다.' },
        { text: 'No zones.', meaning: '지역 수비 없어.' }
      ]
    },
    nuanceTip: '"Man for man"은 맨투맨, "Zones"는 지역 수비다.\n이 전환 지시가 코너킥 전에 나오면 즉시 내가 어떤 선수를 마크할지 확인해야 한다.\n"Who\'s got number nine?"처럼 바로 책임 소재를 물어봐야 한다. 침묵은 실점이다.',
    ctaText: 'TAL 앱에서 5번 말해보기 →',
    ctaLink: 'tal://session/CP23_Practice'
  },
  {
    id: '19',
    title: '드라이브',
    situation: '공을 잡았는데 앞에 공간이 넓게 열려 있다. 1대1 상황 또는 상대 수비가 아직 정비가 안 됐다.\n주저하지 말고 공을 가지고 전진해서 드리블 돌파를 해야 할 타이밍이다.\n동료 또는 감독이 외친다.',
    dialogues: [
      { speaker: '선수 A (CM / 감독)', text: 'Drive! Drive at him! You\'ve got space!', action: '전진 드리블 지시' },
      { speaker: '선수 B (공 보유자)', text: '(전진하며) Yeah!', action: '공간을 이용해 전진' }
    ],
    keyExpressions: {
      lCode: 'SCR-19',
      tier: '1',
      items: [
        { text: 'Drive.', meaning: '전진해. / 돌파해.' },
        { text: 'Drive at him!', meaning: '그 선수한테 치고 들어가!' }
      ]
    },
    nuanceTip: '"Drive"는 그냥 뛰라는 게 아니다. 공을 발에 붙이고 상대를 향해 공격적으로 전진하라는 뜻이다.\n공간이 열렸을 때 주저하지 말라는 신호이기도 하다.\n빨리 반응하지 않으면 공간이 닫힌다.',
    ctaText: '지금 이 표현 연습하기 →',
    ctaLink: 'tal://session/CP19_Practice'
  },
  // Act 1
  {
    id: '04',
    title: '내려와서 볼 받기',
    situation: '내가 센터백, 사이드백, 또는 미드필더로 공을 잡았는데 전방 패스 옵션이 보이지 않는다.\n상대 미드필더가 패스 라인을 막고 있다. 우리 팀 공격형 미드필더가 짧게 내려와서\n공을 받을 자리를 만들어줘야 공격을 풀어나갈 수 있다.\n내려와서 공간을 만들지 않으면 패스 자체가 불가능한 상황이다.',
    dialogues: [
      { speaker: '선수 A (CB / SB)', text: 'Come on! Come short! Show for the ball!', action: '전방 미드필더에게 내려와 달라고 요청' },
      { speaker: '선수 B (CM / AM)', text: 'Yes! Got it!', action: '체크인 무브먼트로 짧게 내려오며 공간을 만듦' }
    ],
    keyExpressions: {
      lCode: 'SC-21',
      tier: '1~2',
      items: [
        { text: 'Come to the ball!', meaning: '볼 쪽으로 와!' },
        { text: 'Come short!', meaning: '짧게 내려와!' },
        { text: 'Check in!', meaning: '와서 받아!' },
        { text: 'Show for the ball!', meaning: '볼 받을 준비 표시해!' }
      ]
    },
    nuanceTip: '볼을 소유한 선수가 패스할 공간을 찾을 때 받는 선수가 움직임을 보여줘야 한다.\n"Show for the ball"은 "너 어디 있는지 몸으로 보여줘"라는 뜻이다.\n이 말이 들리면 즉시 내려와서 몸으로 공간을 만들어야 패스 연결이 가능해진다.\n\n[추가 상황 — 깊게 내려올 때]\n❝ Drop deep! ❞ — 깊이 내려와! (수비진 깊숙이까지 내려와야 할 때 쓰는 표현)',
    ctaText: '앱에서 더 많은 표현 보기 →',
    ctaLink: 'tal://session/CP04_Practice'
  },
  {
    id: '05',
    title: '넓게/안으로',
    situation: '공이 전환되는 상황. 우리 팀이 공격을 전개하고 있는데 사이드 윙어나 풀백이\n중앙으로 좁혀와 있어서 사이드 공간이 비어 있다.\n공을 사이드로 전개할 공간이 없어지면서 공격 흐름이 막힌다.\n미드필더가 공을 잡고 사이드 선수에게 다시 벌어지라고 외친다.',
    dialogues: [
      { speaker: '선수 A (CM)', text: 'Stay wide! Width! Keep the width!', action: '좁혀오는 윙어에게 외침' },
      { speaker: '선수 B (LW / RW)', text: 'Got it! Wide!', action: '터치라인 쪽으로 벌어짐' }
    ],
    keyExpressions: {
      lCode: 'SC-22A',
      tier: '2',
      items: [
        { text: 'Stay wide!', meaning: '넓게 유지해!' },
        { text: 'Get wide!', meaning: '사이드로 벌려!' }
      ]
    },
    nuanceTip: '"Width"는 전술적 폭이다. 사이드가 좁혀들면 상대 수비가 중앙에 집중돼 공간이 사라진다.\n"Stay wide"가 들리면 터치라인 쪽으로 당장 벌어져야 한다. "Get wide!"도 같은 의미다.\n\n[추가 상황 — 안으로 좁힐 때]\n❝ Tuck in! ❞ — 안으로 좁혀!\n❝ Go inside! ❞ — 안쪽으로!',
    ctaText: '경기장에서 쓰기 전에 연습하기 →',
    ctaLink: 'tal://session/CP05_Practice'
  },
  {
    id: '02',
    title: '볼 유지',
    situation: '우리 팀이 빌드업 중이다. 공이 내게 왔는데 우리 골문 방향으로 등지고 공을 받았다.\n돌아야 하나, 바로 패스해야 하나 판단이 서지 않는다. 바로 앞에는 상대 선수가 없다.\n동료가 "Time!"이라고 외친다. 아, 여유가 있구나. 일단 공을 잡고 주변을 살피자.',
    dialogues: [
      { speaker: '선수 A (CM)', text: 'Time! You\'ve got time. Keep it!', action: '볼 캐리어에게 여유 있음을 즉시 알려줌' },
      { speaker: '선수 B (CB / 볼 캐리어)', text: 'Got it.', action: '공을 잡고 드리블하며 옵션을 탐색함' }
    ],
    keyExpressions: {
      lCode: 'SC-15',
      tier: '1',
      items: [
        { text: 'Keep it!', meaning: '볼 잡아둬!' },
        { text: 'Hold it!', meaning: '잡아!' },
        { text: 'Time!', meaning: '여유 있어! (상대 없어!)' }
      ]
    },
    nuanceTip: '"Man on!"과 정반대 표현이다. "Man on" = 빨리 처리해, "Time" = 천천히 해도 돼.\n해외 팀에서 "Time" 소리가 들리면 패닉 패스 하지 말고 일단 공을 잡아라.\n한국에서 "공 잡아놔", "공 끌고 있어", "여유 있어", "아무도 없어"와 같이 쓰인다.',
    ctaText: '앱에서 훈련하기 →',
    ctaLink: 'tal://session/CP02_Practice'
  },
  {
    id: '06',
    title: '뒷공간 침투',
    situation: '상대 수비라인이 매우 높게 올라와 있다. 우리 공격수가 계속 내려와서 공을 받으려 하는데\nshort 패스만으로는 뚫기가 힘든 상황이다. 미드필더 또는 감독이 라커룸에서,\n또는 경기 중 공격수에게 외친다. "나와서 받지 말고 수비 뒤로 뛰어서 받아."',
    dialogues: [
      { speaker: '선수 A (CM 또는 감독)', text: 'Don\'t come short! Run in behind! Hit the space!', action: '침투 런을 지시함' },
      { speaker: '선수 B (ST / CF)', text: 'Yeah! On my way!', action: '수비 뒷공간으로 전력 질주하며 응답' }
    ],
    keyExpressions: {
      lCode: 'SC-23',
      tier: '2',
      items: [
        { text: 'Run in behind!', meaning: '뒷공간으로 침투해!' },
        { text: 'Hit the space!', meaning: '공간 파고들어!' }
      ]
    },
    nuanceTip: '상대 수비라인이 높을수록 뒷공간은 넓어진다.\n내려와서 받는 습관이 든 선수는 이 표현이 들릴 때 즉시 방향을 바꿔야 한다.\n"Run in behind"는 전술 지시이자 득점 기회 신호다.',
    ctaText: 'TAL 앱에서 5번 말해보기 →',
    ctaLink: 'tal://session/CP06_Practice'
  },
  {
    id: '20',
    title: '전진 플레이',
    situation: '하프타임 라커룸 또는 경기 직전, 감독이 전술 지시를 내린다.\n상대가 계속 높은 라인으로 공격적으로 올라오고 있으니\n공을 빼앗거나 패스를 차단하면 즉시 전방으로 연결하라는 사전 전술 지시다.',
    dialogues: [
      { speaker: '선수 A (감독)', text: 'When you win the ball — play forward. As quickly as you can. Don\'t wait.', action: '사전 전술 지시' },
      { speaker: '선수 B (선수들)', text: 'Yes, gaffer!', action: '전술 지시를 수긍' }
    ],
    keyExpressions: {
      lCode: 'TC-A-30',
      tier: '3',
      items: [
        { text: 'Play forward as quickly as you can.', meaning: '최대한 빨리 전방으로 연결해.' }
      ]
    },
    nuanceTip: '"Gaffer"는 영국 축구에서 감독을 부르는 슬랭이다.\n이 지시가 나오면 공 뺏는 순간 빠른 전방 연결이 팀 전술의 핵심이다.\n느리면 상대가 다시 수비 조직을 갖춘다.\n\n[추가 상황 — 볼 후방으로 돌릴 때]\n❝ Play back. ❞ — 후방으로 돌려. (감독의 사전 전술 지시)',
    ctaText: '지금 이 표현 연습하기 →',
    ctaLink: 'tal://session/CP20_Practice'
  },
  // Act 2
  {
    id: '07',
    title: '공중볼 경합',
    situation: '내가 센터백이다. 사이드에서 크로스가 올라오는데 공 궤적을 보니 내 머리 위를 넘어갈 것 같다.\n헤딩 타이밍을 놓쳤다. 내 뒤에 동료 수비수가 있다.\n공 처리 책임을 동료에게 넘겨야 한다.',
    dialogues: [
      { speaker: '선수 A (CB #4)', text: 'Over me! Over! Yours!', action: '공이 머리 위로 넘어가자 즉시 동료에게 알림' },
      { speaker: '선수 B (CB #5 / SW)', text: 'Mine! I\'ve got it!', action: '소유권을 선언하며 점프해서 공을 처리' }
    ],
    keyExpressions: {
      lCode: 'SC-25A',
      tier: '1',
      items: [
        { text: 'Over!', meaning: '(나한테) 넘어온다!' },
        { text: 'Over me!', meaning: '내 쪽으로 온다!' },
        { text: 'Get up!', meaning: '헤딩해!' },
        { text: 'Head it!', meaning: '머리로 처리해!' }
      ]
    },
    nuanceTip: '"Over me"는 "내 위로 넘어간다", "Yours"는 "네가 처리해".\n이 두 표현이 연속으로 나오면 즉시 다음 수비수가 책임을 가져가야 한다. 침묵은 곧 실점이다.\n\n[추가 상황 — 볼 양보할 때]\n❝ Yours! ❞ — 네 공! (양보)\n❝ Mine! ❞ — 내 공! (소유 선언)',
    ctaText: '앱에서 더 많은 표현 보기 →',
    ctaLink: 'tal://session/CP07_Practice'
  },
  {
    id: '01',
    title: '볼 걷어내기',
    situation: '위기 수비 상황. 우리 팀이 페널티 박스 안에서 수비 중이다.\n코너킥이나 크로스 이후 공이 박스 안으로 떨어진다. 잡으려는 순간 바로 앞에 상대 선수가 달려온다.\n트래핑할 시간이 없다. 옆에 있던 동료 수비수가 소리친다.',
    dialogues: [
      { speaker: '선수 A (CB)', text: 'Clear it! Away!', action: '공이 박스 안으로 떨어지자 동료 CB가 강하게 외친다' },
      { speaker: '선수 B (CB / 볼 처리자)', text: 'Got it!', action: '발로 강하게 걷어내며 응답' }
    ],
    keyExpressions: {
      lCode: 'SC-12',
      tier: '1',
      items: [
        { text: 'Clear!', meaning: '걷어내!' },
        { text: 'Clear it!', meaning: '볼 걷어내!' },
        { text: 'Away!', meaning: '멀리 차!' }
      ]
    },
    nuanceTip: '박스 안에서 공을 잡으려다 뺏기면 바로 실점이다. "Clear it!"은 명령이자 경고다.\n이 말이 들리는 순간 머리로 생각하지 말고 몸이 먼저 반응해야 한다.',
    ctaText: '경기장에서 쓰기 전에 연습하기 →',
    ctaLink: 'tal://session/CP01_Practice'
  },
  {
    id: '08',
    title: '협력 압박',
    situation: '상대 공격수가 터치라인 부근에서 밖을 본 자세로 고립됐다.\n우리 풀백이 달려들어 1대1로 압박하고 있는데 아직 볼을 뺏지 못하고 있다.\n옆에 있는 미드필더가 달려들며 협력 수비를 지시한다.',
    dialogues: [
      { speaker: '선수 A (CM)', text: 'Double up! Tight!', action: '풀백에게 협력 수비 지시' },
      { speaker: '선수 B (RB)', text: 'Got him! Tight!', action: '함께 달려들며 볼 탈취 시도' }
    ],
    keyExpressions: {
      lCode: 'SC-27A',
      tier: '1',
      items: [
        { text: 'Double!', meaning: '둘이 같이 압박해!' },
        { text: 'Tight!', meaning: '바짝 붙어!' }
      ]
    },
    nuanceTip: '"Double"은 혼자 뺏으려다 역습 허용하는 걸 막기 위한 조직적 압박 지시다.\n두 명이 동시에 압박하면 상대는 선택지가 없다.\n"Tight!"은 돌아서지 못하게 몸을 밀착시키라는 뜻이다.',
    ctaText: '앱에서 훈련하기 →',
    ctaLink: 'tal://session/CP08_Practice'
  },
  {
    id: '11',
    title: '금지 명령',
    situation: '상대 공격수가 1대1로 나를 향해 달려오고 있다. 확 달려들고 싶지만\n그러면 드리블로 빠져나가 슈팅 찬스가 생긴다.\n옆에 동료 수비수가 달려들려는 나를 보고 소리친다.',
    dialogues: [
      { speaker: '선수 A (CB)', text: 'Don\'t dive in! Stay on your feet! Show him outside!', action: '달려들려는 수비수에게 경고하며 포지션 지시' },
      { speaker: '선수 B (RB / 수비수)', text: 'Okay, okay! Blocking!', action: '자제하고 각도를 차단하는 포지션으로 이동' }
    ],
    keyExpressions: {
      lCode: 'SC-30',
      tier: '2',
      items: [
        { text: 'Don\'t dive in!', meaning: '뛰어들지 마!' },
        { text: 'Stay on your feet!', meaning: '넘어지지 마!' },
        { text: 'Show him outside!', meaning: '바깥쪽으로 몰아! (유도)' },
        { text: 'Force him wide!', meaning: '사이드로 강제로 몰아!' },
        { text: 'Push him wide!', meaning: '바깥쪽으로 밀어내!' }
      ]
    },
    nuanceTip: '"Dive in"은 태클하러 무작정 달려드는 행위다. 달려들어서 빠져나가면 다음 라인이 없다.\n"Don\'t dive in"은 "버텨, 시간을 끌어"라는 전술적 지시다.\n세 표현(Show / Force / Push him wide)은 모두 "상대를 사이드로 유도하라"는 같은 전술 개념이다.\n"Show"는 몸 각도로 길을 열어주듯 유도, "Force"는 선택지 자체를 없애는 강한 버전, "Push"는 즉각적인 반응 표현이다.',
    ctaText: 'TAL 앱에서 5번 말해보기 →',
    ctaLink: 'tal://session/CP11_Practice'
  },
  {
    id: '21',
    title: '압박 시 볼 처리',
    situation: '지금 이 순간, 공을 잡았는데 상대 선수 두세 명이 즉시 달려들고 있다.\n전방 옵션도 없고 잡고 있다가는 당장 뺏길 것 같다.\n억지로 버티다가 볼을 뺏기면 바로 역습을 허용하는 위험한 상황이다.\n옆 또는 뒤에 있는 동료가 소리친다.',
    dialogues: [
      { speaker: '선수 A (CB / 동료)', text: 'Bounce it! You\'re under pressure — play it back! Come on!', action: '압박 받는 선수에게 즉각 리턴 패스 지시' },
      { speaker: '선수 B (볼 캐리어)', text: 'Back!', action: '즉각적으로 리턴 패스하며 압박에서 탈출' }
    ],
    keyExpressions: {
      lCode: 'TC-A-34',
      tier: '3',
      items: [
        { text: 'Bounce it back if you\'re under a lot of pressure.', meaning: '압박 많이 받으면 바로 되돌려. / 바로 주고 받아.' }
      ]
    },
    nuanceTip: '"Bounce it back"은 지금 이 순간 압박을 받고 있는 실시간 반응 표현이다.\n#20의 "Play back"이 감독의 사전 전술 지시라면, "Bounce it back"은 경기 중 현재 상황에 대한 즉각 판단이다.\n공을 붙들다가 뺏기는 것보다 빠른 리턴 패스 한 번이 팀을 지킨다.',
    ctaText: '지금 이 표현 연습하기 →',
    ctaLink: 'tal://session/CP21_Practice'
  },
  {
    id: '10',
    title: '볼 재활용',
    situation: '수비진에서 볼을 잡아서 오른쪽 또는 왼쪽으로 빌드업을 시작했는데\n그쪽이 막혀서 더 이상 줄 곳도 없고, 오히려 프레싱으로 볼을 뺏길 것 같다.\n골키퍼까지 공을 뒤로 빼서 다른 방향으로 재빌드업을 시작해야 한다.',
    dialogues: [
      { speaker: '선수 A (CM)', text: 'Recycle! Switch it! Go back!', action: '볼 캐리어에게 후방 전환 즉시 지시' },
      { speaker: '선수 B (CB / 볼 캐리어)', text: 'Back!', action: 'GK 방향으로 패스하며 재빌드업 시작' }
    ],
    keyExpressions: {
      lCode: 'SC-29',
      tier: '2',
      items: [
        { text: 'Recycle!', meaning: '볼 되돌려! / 볼 다시 돌려!' },
        { text: 'Switch it!', meaning: '반대편으로 돌려!' }
      ]
    },
    nuanceTip: '"Recycle"은 포기가 아니라 전략이다.\n막힌 쪽에서 억지로 뚫으려다 볼 뺏기면 바로 역습 허용이다.\n뒤로 돌려서 다른 공간을 찾는 것이 더 영리한 판단이다.',
    ctaText: '앱에서 더 많은 표현 보기 →',
    ctaLink: 'tal://session/CP10_Practice'
  },
  {
    id: '18',
    title: '각도 좁히기',
    situation: '상대가 크로스나 슈팅을 할 때 하지 못하도록 각도를 차단하라는 뜻.\n상대 공격수가 박스 사이드에서 슈팅을 준비하고 있다.\n태클하러 달려들면 안 된다. 각도만 막아야 한다.\nDon\'t dive in(#11)과 이어지는 상황이다.',
    dialogues: [
      { speaker: '선수 A (감독 / CB)', text: 'Cut down the angle! Don\'t dive in — just block the shot!', action: '각도 차단 지시' },
      { speaker: '선수 B (RB / 수비수)', text: 'Blocking!', action: '각도를 차단하는 포지션으로 이동' }
    ],
    keyExpressions: {
      lCode: 'SCR-18',
      tier: '2',
      items: [
        { text: 'Cut down the angles.', meaning: '슈팅 각도 막아.' }
      ]
    },
    nuanceTip: '"Cut down the angle"은 골대와 공격수 사이의 각도를 줄이라는 뜻이다.\n태클하러 달려들면 각도가 오히려 열린다.\n몸을 앞에 갖다 놓는 것만으로도 슈팅 공간이 줄어든다. Don\'t dive in(#11)과 세트로 기억해라.',
    ctaText: '경기장에서 쓰기 전에 연습하기 →',
    ctaLink: 'tal://session/CP18_Practice'
  },
  // Act 3
  {
    id: '15',
    title: '수비 라인 유지',
    situation: '수비 라인을 맞출 때 쓸 수 있는 표현.\n우리 진영에서 수비하다가 공을 걷어내고 라인을 끌어올릴 타이밍이다.\n또는 더 이상 내려서지 말고 현재 라인을 유지해야 하는 상황이다.',
    dialogues: [
      { speaker: '선수 A (캡틴 / CB)', text: 'Step up! Up together! Hold the line now!', action: '수비라인 전체를 일제히 끌어올리는 지시' },
      { speaker: '선수 B (DF 라인 전체)', text: 'Hold!', action: '라인 유지 확인하며 일제히 전진' }
    ],
    keyExpressions: {
      lCode: 'SC-10A',
      tier: '1',
      items: [
        { text: 'Step up!', meaning: '앞으로 나가!' },
        { text: 'Up!', meaning: '올라와!' }
      ]
    },
    nuanceTip: '"Step up"은 타이밍이 핵심이다. 혼자 올라가면 오프사이드 트랩이 깨진다.\n"Together"와 세트다. 한 명이라도 늦으면 뒷공간이 열린다.\n\n[추가 상황 — 라인 내려올 때 / 유지할 때]\n❝ Drop! ❞ — 내려와!\n❝ Hold! ❞ — 위치 잡아!\n❝ Hold the line! ❞ — 라인 유지해!',
    ctaText: '앱에서 훈련하기 →',
    ctaLink: 'tal://session/CP15_Practice'
  },
  {
    id: '09',
    title: '마킹 지시',
    situation: '상대 코너킥 상황이다. 선수들이 박스 안에 배치되는데\n한 명의 상대 선수가 아직 마크가 안 된 채로 비어 있다.\n수비 리더가 즉시 소리친다.',
    dialogues: [
      { speaker: '선수 A (CB / 수비 리더)', text: 'Mark up! Pick him up — number nine, who\'s got him?', action: '비어있는 선수를 가리키며 책임 소재를 즉시 묻는다' },
      { speaker: '선수 B (CM)', text: 'I\'ve got him! On me!', action: '즉시 마크 책임을 선언하며 상대에게 붙음' }
    ],
    keyExpressions: {
      lCode: 'SC-27B',
      tier: '1~2',
      items: [
        { text: 'Mark up!', meaning: '마킹 잡아!' },
        { text: 'Stay on him!', meaning: '계속 붙어!' },
        { text: 'Pick him up!', meaning: '그 선수 마크해!' },
        { text: 'Be on him!', meaning: '붙어!' }
      ]
    },
    nuanceTip: '코너킥에서 한 명 비는 순간 경기가 끝난다.\n"Pick him up!" 들리면 번호나 위치로 바로 확인해야 한다.\n"Who\'s got him?"은 책임 소재를 즉시 묻는 표현이다. 대답 못 하면 내 책임이 된다.',
    ctaText: 'TAL 앱에서 5번 말해보기 →',
    ctaLink: 'tal://session/CP09_Practice'
  },
  {
    id: '16',
    title: '상대가 침투할 때',
    situation: '상대 팀 선수가 우리 수비 라인 뒤로 침투 런을 시도하고 있다.\n담당 풀백 또는 센터백이 그 선수를 아직 인지하지 못한 상태다.\n골키퍼나 다른 수비수가 즉시 알려줘야 한다.',
    dialogues: [
      { speaker: '선수 A (GK / CM)', text: 'Runner! Watch the run! Runner on your right!', action: '침투 선수를 즉시 알리고 방향까지 전달' },
      { speaker: '선수 B (CB / RB)', text: 'Got him! On me!', action: '즉시 돌아서며 마크 책임 선언' }
    ],
    keyExpressions: {
      lCode: 'SC-28',
      tier: '1~2',
      items: [
        { text: 'Runner!', meaning: '침투 선수 있어!' },
        { text: 'Watch the run!', meaning: '침투 조심해!' }
      ]
    },
    nuanceTip: '침투 런은 0.5초면 끝난다. "Runner!"는 최대한 빠르고 크게 외쳐야 한다.\n방향까지 "Runner on your left!"로 추가하면 수비가 즉시 대응할 수 있다.',
    ctaText: '지금 이 표현 연습하기 →',
    ctaLink: 'tal://session/CP16_Practice'
  },
  {
    id: '14',
    title: '상대 위치 알림',
    situation: '공을 가지고 있는 동료나 볼 경합 중인 선수가 뒤에서 달려오는 상대를 인지하지 못하고 있다.\n사각지대에서 상대가 빠르게 달려온다. 0.5초 안에 알려줘야 한다.',
    dialogues: [
      { speaker: '선수 A (CM / 주변 선수)', text: 'Behind you! On your right!', action: '위험 상황을 즉시 알림' },
      { speaker: '선수 B (볼 캐리어)', text: '(방향 전환하며) Thanks!', action: '상황 인지 후 처리' }
    ],
    keyExpressions: {
      lCode: 'SC-26',
      tier: '1',
      items: [
        { text: 'Behind you!', meaning: '뒤에 있어!' },
        { text: 'On your right!', meaning: '오른쪽에 있어!' },
        { text: 'On your left!', meaning: '왼쪽에 있어!' }
      ]
    },
    nuanceTip: '이 표현은 0.5초가 전부다. "Behind you!"는 듣는 즉시 몸이 반응해야 한다.\n방향, 거리, 위험도를 단 두 단어로 전달한다. 방향까지 "On your left!"로 추가하면 더 빠르게 대응할 수 있다.\n\n[추가 상황 — 라인 정비 시 (주위 살펴)]\n❝ Check your shoulder! ❞ — 주위 살펴! (상대 위치 확인)',
    ctaText: '앱에서 더 많은 표현 보기 →',
    ctaLink: 'tal://session/CP14_Practice'
  },
  {
    id: '12',
    title: '주의 각성',
    situation: '공중볼이 우리 수비 진영으로 높이 떠오르고 있다. 볼이 어디로 떨어질지 궤적이 순간 불분명하다.\n수비수들이 공의 낙하 지점에 집중하지 못하거나, 볼을 뺏긴 직후 수비 전환이 늦어지고 있다.\n캡틴 또는 수비 리더가 즉각 소리친다.',
    dialogues: [
      { speaker: '선수 A (캡틴 / CB)', text: 'Heads up! Everyone — reaction! Come on!', action: '전체를 향해 집중 촉구' },
      { speaker: '선수 B (팀 전체)', text: 'Let\'s go!', action: '즉시 자리 잡으며 수비 전환' }
    ],
    keyExpressions: {
      lCode: 'SC-31',
      tier: '1',
      items: [
        { text: 'Reaction!', meaning: '반응해! / 집중!' },
        { text: 'Heads up!', meaning: '고개 들어! / 주의!' }
      ]
    },
    nuanceTip: '"Heads up"은 문자 그대로 "고개 들어"지만 경기장에서는 "정신 차려, 집중해"다.\n"Reaction!"은 "즉시 반응하라"는 명령이다.\n볼 뺏긴 직후 또는 공중볼 상황에서 이 말이 들리면 즉시 수비 전환이다. 0.5초가 전부다.',
    ctaText: '경기장에서 쓰기 전에 연습하기 →',
    ctaLink: 'tal://session/CP12_Practice'
  },
  // Act 4
  {
    id: '03',
    title: '실수 후 회복',
    situation: '내 실수로 골을 허용했다. 실망감에 고개가 떨어지고 발걸음이 무거워진다.\n센터서클로 돌아가는 길에 동료가 어깨를 두드리며 다가온다.\n이 말을 못 알아들으면 동료가 뭐라고 하는 것 같아서 더 신경 쓰이고 주눅든다.',
    dialogues: [
      { speaker: '선수 A (동료 CF)', text: 'Hey. Shake it off. Next play.', action: '실수한 동료에게 다가가며 어깨를 두드린다' },
      { speaker: '선수 B (실수한 GK / 수비수)', text: 'Yeah... I\'m good. Let\'s go.', action: '고개를 들고 다시 집중함' }
    ],
    keyExpressions: {
      lCode: 'SC-18',
      tier: '2',
      items: [
        { text: 'Shake it off!', meaning: '털어내! / 잊어버려!' },
        { text: 'Next play!', meaning: '다음 플레이 가자!' }
      ]
    },
    nuanceTip: '"Shake it off"는 경기장에서 "털어버려, 잊어"라는 뜻이다.\n"Next play"와 세트로 쓰인다. 모르면 동료가 뭐라고 하는 것처럼 들려서 멘탈이 더 흔들린다.\n이 말이 들리는 순간 고개를 들고 "Let\'s go"로 받아치면 된다.',
    ctaText: '앱에서 훈련하기 →',
    ctaLink: 'tal://session/CP03_Practice'
  },
  {
    id: '13',
    title: '감정 표현',
    situation: '동료가 어려운 상황에서 환상적인 플레이를 해냈다.\n멋진 드리블 돌파, 극적인 태클, 또는 중요한 순간의 골.\n자연스럽게 반응하고 싶은데 영어로 뭐라고 해야 할지 모른다.',
    dialogues: [
      { speaker: '선수 A (LW / 동료)', text: 'Unreal! What a goal, man! Absolute worldie!', action: '골 후 달려오며 극찬' },
      { speaker: '선수 B (ST / 골 넣은 선수)', text: 'Thanks! Let\'s go! Come on!', action: '받아치며 팀 분위기 올림' }
    ],
    keyExpressions: {
      lCode: 'SC-34',
      tier: '1~2',
      items: [
        { text: 'Well done!', meaning: '잘했어!' },
        { text: 'Unreal!', meaning: '말도 안 돼! / 비현실적이다! (극찬)' },
        { text: 'What a goal!', meaning: '골 미쳤다!' },
        { text: 'What a pass!', meaning: '패스 미쳤다!' }
      ]
    },
    nuanceTip: '"Well done"은 격식 있는 칭찬, "Unreal"은 "말도 안 돼" 수준의 극찬이다.\n"Worldie"는 현장에서 자주 들리는 영국 슬랭으로 \'엄청난 플레이\'라는 뜻.\n이 표현들을 자연스럽게 내뱉으면 팀메이트와의 거리가 확 좁혀진다.',
    ctaText: 'TAL 앱에서 5번 말해보기 →',
    ctaLink: 'tal://session/CP13_Practice'
  }
];

export default function EbookPage() {
  const [progress, setProgress] = useState(0);
  const [currentCard, setCurrentCard] = useState('1');

  // To track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = document.body.scrollHeight - window.innerHeight;
      if (height > 0) {
        setProgress((scrollY / height) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // To track current card via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const num = entry.target.id.replace('card-', '');
            setCurrentCard(num);
          }
        });
      },
      { threshold: 0.5 }
    );

    const cards = document.querySelectorAll('[id^="card-"]');
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  const openApp = (cardId: string) => {
    const deeplink = `tal://session/CP${cardId}_Practice`;
    window.location.href = deeplink;
    setTimeout(() => {
      window.location.href = 'https://talroi.com/download';
    }, 2000);
  };


  const renderCard = (card: CardData, index: number) => {
    const displayNum = index + 1;
    return (
      <article id={`card-${displayNum}`} key={card.id} className="px-5 py-8 border-b border-[#1B2B4B]">
        {/* 컨텍스트 태그 */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-[#00E676] font-bold tracking-widest">
            CALLPLAY #{card.id}
          </p>
        </div>

        <h3 className="text-2xl font-black text-white mb-6">
          {card.title}
        </h3>

        {/* 상황 (Situation) */}
        <div className="bg-[#1B2B4B]/30 border border-[#1B2B4B] p-4 rounded-xl mb-6">
          <p className="text-sm text-[#B0BEC5] leading-relaxed whitespace-pre-wrap">
            <span className="font-bold text-[#2979FF] mb-2 block">🔷 상황 (Situation)</span>
            {card.situation}
          </p>
        </div>

        {/* 대화 스크립트 */}
        <div className="mb-8 space-y-3">
          <p className="text-sm font-bold text-white mb-3">🗣️ 대화 스크립트</p>
          {card.dialogues.map((dlg, idx) => (
            <div key={idx} className="bg-[#0A0E1A] border border-[#1B2B4B] p-4 rounded-xl relative">
              <span className="text-xs text-[#2979FF] font-semibold mb-1 block">{dlg.speaker}</span>
              <p className="text-base text-white font-bold mb-2 leading-snug">❝ {dlg.text} ❞</p>
              <p className="text-xs text-[#546E7A]">→ {dlg.action}</p>
            </div>
          ))}
        </div>

        {/* 핵심 표현 */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <p className="text-sm font-bold text-[#00E676]">⚡ 핵심 표현</p>
            <p className="text-[10px] text-[#546E7A] uppercase tracking-wider">Tier: {card.keyExpressions.tier}</p>
          </div>
          <div className="space-y-3">
            {card.keyExpressions.items.map((item, idx) => (
              <div key={idx} className="flex flex-col border-b border-[#1B2B4B]/50 pb-3">
                <span className="text-xl font-black text-white mb-1">❝ {item.text} ❞</span>
                <span className="text-sm text-[#B0BEC5] font-medium">{item.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 뉘앙스 팁 */}
        <div className="mb-8">
          <p className="text-sm text-[#B0BEC5] leading-relaxed whitespace-pre-wrap">
            <span className="font-bold text-[#FFD54F] mb-2 block">💡 뉘앙스 팁</span>
            {card.nuanceTip}
          </p>
        </div>

        {/* 앱 CTA */}
        <button
          onClick={() => openApp(card.id)}
          className="flex items-center justify-center w-full h-14 rounded-xl bg-[#00E676] text-[#0A0E1A] font-bold text-base hover:bg-[#00C853] transition-colors mt-8 shadow-[0_0_15px_rgba(0,230,118,0.3)]"
        >
          {card.ctaText}
        </button>
      </article>
    );
  };

  const renderAppBanner = () => (
    <div className="mx-5 my-8 p-5 rounded-2xl bg-[#1B2B4B] border border-[#2979FF]">
      <p className="text-xs text-[#2979FF] font-semibold mb-2">TAL APP</p>
      <p className="text-base text-white font-bold mb-1">앱에서 실제로 말해봤어?</p>
      <p className="text-sm text-[#B0BEC5] mb-4">
        읽는 것과 말하는 것은 다르다.<br />
        STT가 발음을 바로 채점한다.
      </p>
      <a
        href="/register"
        className="flex items-center justify-center w-full h-12 rounded-xl bg-[#00E676] text-[#0A0E1A] font-bold text-sm hover:bg-[#00C853] transition-colors shadow-[0_0_15px_rgba(0,230,118,0.3)]"
      >
        무료로 훈련 시작하기 →
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white font-sans antialiased">
      <Head>
        <title>TAL 콜플레이 22선</title>
        <meta name="description" content="해외 피치에서 살아남는 22가지 핵심 표현" />
      </Head>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0A0E1A]/90 backdrop-blur border-b border-[#1B2B4B]">
        <div className="max-w-[640px] mx-auto">
          <div className="flex items-center justify-between px-5 h-12">
            <span className="font-black text-white text-sm">TAL</span>
            <span className="text-[#B0BEC5] text-xs">콜플레이 22선</span>
            <span className="text-[#00E676] text-xs font-mono" id="card-counter">{currentCard}/22</span>
          </div>
          <div className="h-1 bg-[#1B2B4B]">
            <div id="progress-bar" className="h-full bg-[#00E676] transition-all duration-200" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto">
        {/* Hero Section */}
        <section className="min-h-[calc(100vh-48px)] flex flex-col justify-center px-5 bg-[#0A0E1A]">
          <span className="inline-block self-start mb-6 px-3 py-1 text-xs text-[#2979FF] border border-[#2979FF] rounded-full bg-[#1B2B4B]">
            TAL 콜플레이 시리즈
          </span>
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            경기는<br />말로 시작된다
          </h1>
          <p className="text-base text-[#B0BEC5] mb-12">
            해외 피치에서 살아남는<br />22가지 핵심 표현
          </p>
          <div className="animate-bounce text-[#B0BEC5] text-sm">↓ 지금 읽기 시작</div>
        </section>

        {/* Top App CTA Banner */}
        <div style={{
          background: 'rgba(0,230,118,.08)',
          border: '1px solid rgba(0,230,118,.3)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          margin: '0 20px 32px 20px'
        }}>
          <div>
            <p style={{ color: '#00E676', fontWeight: 800, fontSize: '15px', margin: 0 }}>
              읽는 것보다 말하는 게 더 빠르다
            </p>
            <p style={{ color: '#B0BEC5', fontSize: '13px', margin: '4px 0 0' }}>
              TAL 앱에서 직접 발화하고 AI 채점을 받아봐.
            </p>
          </div>
          <a
            href="/register"
            style={{
              background: '#00E676',
              color: '#0A0E1A',
              fontWeight: 800,
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              whiteSpace: 'nowrap'
            }}
          >
            무료 훈련 시작 →
          </a>
        </div>

        {/* Prologue */}
        <div className="bg-[#0D1B2A] px-5 pt-10 pb-8 border-l-4 border-[#00E676]">
          <p className="text-xs text-[#00E676] font-semibold tracking-widest uppercase mb-2">PROLOGUE · 킥오프 전</p>
          <h2 className="text-2xl font-bold text-white mb-2">킥오프 전</h2>
          <p className="text-sm text-[#B0BEC5]">코치의 지시가 경기를 만든다</p>
          <div className="mt-6 h-px bg-[#1B2B4B]"></div>
        </div>
        <div>{CARDS.slice(0, 3).map((card, i) => renderCard(card, i))}</div>

        {/* Act 1 */}
        <div className="bg-[#0D1B2A] px-5 pt-10 pb-8 border-l-4 border-[#00E676]">
          <p className="text-xs text-[#00E676] font-semibold tracking-widest uppercase mb-2">ACT 1 · 1' — 30'</p>
          <h2 className="text-2xl font-bold text-white mb-2">공간을 점령해라</h2>
          <p className="text-sm text-[#B0BEC5]">말 한 마디가 포지션을 정한다</p>
          <div className="mt-6 h-px bg-[#1B2B4B]"></div>
        </div>
        <div>{CARDS.slice(3, 8).map((card, i) => renderCard(card, i + 3))}</div>

        {/* 중간 배너 1 */}
        {renderAppBanner()}

        {/* Act 2 */}
        <div className="bg-[#0D1B2A] px-5 pt-10 pb-8 border-l-4 border-[#00E676]">
          <p className="text-xs text-[#00E676] font-semibold tracking-widest uppercase mb-2">ACT 2 · 30' — 60'</p>
          <h2 className="text-2xl font-bold text-white mb-2">경합에서 지지 마라</h2>
          <p className="text-sm text-[#B0BEC5]">볼 다툼은 먼저 소리치는 쪽이 이긴다</p>
          <div className="mt-6 h-px bg-[#1B2B4B]"></div>
        </div>
        <div>{CARDS.slice(8, 15).map((card, i) => renderCard(card, i + 8))}</div>

        {/* Act 3 */}
        <div className="bg-[#0D1B2A] px-5 pt-10 pb-8 border-l-4 border-[#00E676]">
          <p className="text-xs text-[#00E676] font-semibold tracking-widest uppercase mb-2">ACT 3 · 60' — 80'</p>
          <h2 className="text-2xl font-bold text-white mb-2">수비 라인을 지켜라</h2>
          <p className="text-sm text-[#B0BEC5]">침묵한 수비수는 투명인간이 된다</p>
          <div className="mt-6 h-px bg-[#1B2B4B]"></div>
        </div>
        <div>{CARDS.slice(15, 20).map((card, i) => renderCard(card, i + 15))}</div>

        {/* 중간 배너 2 */}
        {renderAppBanner()}

        {/* Act 4 */}
        <div className="bg-[#0D1B2A] px-5 pt-10 pb-8 border-l-4 border-[#00E676]">
          <p className="text-xs text-[#00E676] font-semibold tracking-widest uppercase mb-2">ACT 4 · 80' — 90'+</p>
          <h2 className="text-2xl font-bold text-white mb-2">경기를 끝내라</h2>
          <p className="text-sm text-[#B0BEC5]">마지막 10분, 말이 팀을 살린다</p>
          <div className="mt-6 h-px bg-[#1B2B4B]"></div>
        </div>
        <div>{CARDS.slice(20, 22).map((card, i) => renderCard(card, i + 20))}</div>

        {/* Bottom CTA Section */}
        <section className="px-5 py-12 bg-[#0A0E1A]">
          <div className="h-px bg-[#1B2B4B] mb-10"></div>
          
          <p className="text-xl font-bold text-white mb-2">22개 상황을 모두 봤다.</p>
          <p className="text-xl font-bold text-white mb-8">이제 경기장에 가져가라.</p>

          <a href="/register" className="flex items-center justify-center w-full h-14 rounded-xl bg-[#00E676] text-[#0A0E1A] font-bold text-base mb-4 hover:bg-[#00C853] transition-colors shadow-[0_0_15px_rgba(0,230,118,0.3)]">
            무료로 훈련 시작하기 →
          </a>
          <p className="text-center text-xs text-[#546E7A]">
            가입 후 즉시 Day 1 세션을 체험할 수 있습니다.
          </p>
        </section>
      </main>

      <footer className="px-5 py-10 bg-[#0A0E1A] border-t border-[#1B2B4B]">
        <div className="max-w-[640px] mx-auto">
          <p className="text-sm font-black text-white mb-1">TAL</p>
          <p className="text-xs text-[#546E7A] mb-6">Performance Tool for Football Players</p>
          <div className="flex gap-4 text-xs text-[#546E7A]">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
          </div>
          <p className="text-xs text-[#546E7A] mt-4">© 2026 TAL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
