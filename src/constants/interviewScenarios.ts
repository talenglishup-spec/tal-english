export type ScenarioType = 'WIN' | 'DRW' | 'LST' | 'PRS' | 'ALL';

export type ScenarioId = 
    | 'WIN_HOME_DERBY'
    | 'WIN_AWAY_COMEBACK'
    | 'WIN_CLEAN_SHEET'
    | 'DRW_HOME_LATE_EQUALIZER'
    | 'DRW_AWAY_TOUGH'
    | 'LST_HOME_UPSET'
    | 'LST_AWAY_POOR_PERFORMANCE'
    | 'PRS_DEBUT'
    | 'PRS_RETURN_FROM_INJURY';

export interface InterviewScenario {
    id: ScenarioId;
    type: ScenarioType;
    title_ko: string;
    title_en: string;
    description: string;
    icon: string;
}

export const INTERVIEW_SCENARIOS: InterviewScenario[] = [
    {
        id: 'WIN_HOME_DERBY',
        type: 'WIN',
        title_ko: '홈 더비 매치 승리',
        title_en: 'Home Derby Win',
        description: '라이벌 팀을 상대로 홈에서 극적인 승리를 거둔 후의 인터뷰',
        icon: '🏟️'
    },
    {
        id: 'WIN_AWAY_COMEBACK',
        type: 'WIN',
        title_ko: '원정 역전승',
        title_en: 'Away Comeback Win',
        description: '어려운 원정 경기에서 선제골을 내주고도 역전승을 거둔 상황',
        icon: '🔥'
    },
    {
        id: 'WIN_CLEAN_SHEET',
        type: 'WIN',
        title_ko: '무실점 대승',
        title_en: 'Dominant Clean Sheet',
        description: '완벽한 경기력으로 무실점 대승을 거둔 후',
        icon: '🛡️'
    },
    {
        id: 'DRW_HOME_LATE_EQUALIZER',
        type: 'DRW',
        title_ko: '홈 극장골 무승부',
        title_en: 'Late Equalizer Draw',
        description: '홈 경기에서 패색이 짙던 중 막판 동점골로 비긴 상황',
        icon: '⏱️'
    },
    {
        id: 'DRW_AWAY_TOUGH',
        type: 'DRW',
        title_ko: '원정 1:1 무승부',
        title_en: 'Tough Away Draw',
        description: '강팀을 상대로 어려운 원정 경기에서 귀중한 승점 1점을 챙긴 상황',
        icon: '🤝'
    },
    {
        id: 'LST_HOME_UPSET',
        type: 'LST',
        title_ko: '홈 충격패',
        title_en: 'Home Upset Loss',
        description: '홈에서 예상치 못한 패배를 당해 분위기 반전이 필요한 상황',
        icon: '📉'
    },
    {
        id: 'LST_AWAY_POOR_PERFORMANCE',
        type: 'LST',
        title_ko: '원정 완패',
        title_en: 'Poor Away Loss',
        description: '경기력에서 완전히 밀리며 원정에서 큰 점수차로 패배한 후',
        icon: '🌧️'
    },
    {
        id: 'PRS_DEBUT',
        type: 'PRS',
        title_ko: '팀 데뷔전',
        title_en: 'Team Debut',
        description: '새로운 팀으로 이적 후 첫 데뷔전을 치른 직후의 인터뷰',
        icon: '✨'
    },
    {
        id: 'PRS_RETURN_FROM_INJURY',
        type: 'PRS',
        title_ko: '장기 부상 복귀전',
        title_en: 'Return from Injury',
        description: '몇 달 간의 부상 재활을 마치고 복귀전을 성공적으로 치른 상황',
        icon: '❤️‍🩹'
    }
];
