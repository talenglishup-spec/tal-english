require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

// Pass --force to re-seed even if rows already exist
const FORCE = process.argv.includes('--force');

const questions = [
    { active: 'TRUE', question_id: 'Q001', question_en: 'What did you make of the game / performance?', question_ko: '오늘 경기/경기력에 대해 어떻게 평가하시나요?', pattern_type: 'emotional', primary_tags: 'performance,result', difficulty: '1', followup_group_id: '', frequency_rank: '1', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'overall, pleased, difficult, credit' },
    { active: 'TRUE', question_id: 'Q002', question_en: 'How are you feeling? / How did it feel?', question_ko: '지금 기분/소감이 어떠신가요?', pattern_type: 'emotional', primary_tags: 'emotion,personal', difficulty: '1', followup_group_id: '', frequency_rank: '2', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'delighted, gutted, proud, relieved' },
    { active: 'TRUE', question_id: 'Q003', question_en: 'Can you talk us through the goal?', question_ko: '득점 상황에 대해 자세히 설명해 주시겠어요?', pattern_type: 'tactical', primary_tags: 'analysis,goal', difficulty: '2', followup_group_id: '', frequency_rank: '3', min_level: 'L1', scenario_tags: 'WIN,DRW', hint_keywords: 'cross, finish, space, timing' },
    { active: 'TRUE', question_id: 'Q004', question_en: 'What did the manager say to you at half-time?', question_ko: '하프타임에 감독님이 어떤 말씀을 하셨나요?', pattern_type: 'tactical', primary_tags: 'tactics,halftime', difficulty: '2', followup_group_id: 'FUP_01', frequency_rank: '4', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'tighten up, press higher, stay compact, focus' },
    { active: 'TRUE', question_id: 'Q005', question_en: 'How pleased were you with the character and spirit the team showed?', question_ko: '오늘 팀이 보여준 투지와 정신력에 얼마나 만족하시나요?', pattern_type: 'positive', primary_tags: 'mentality,team', difficulty: '2', followup_group_id: '', frequency_rank: '5', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'character, resilience, spirit, together' },
    { active: 'TRUE', question_id: 'Q006', question_en: 'Can you give us an update on the injury / fitness situation?', question_ko: '부상 및 체력 상태에 대한 업데이트가 있나요?', pattern_type: 'defensive', primary_tags: 'injury,fitness', difficulty: '2', followup_group_id: '', frequency_rank: '6', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'scan, recover, week-to-week, available' },
    { active: 'TRUE', question_id: 'Q007', question_en: 'How important was the atmosphere and the fans today?', question_ko: '오늘 경기장 분위기와 팬들의 응원이 얼마나 중요했나요?', pattern_type: 'positive', primary_tags: 'fans,atmosphere', difficulty: '1', followup_group_id: '', frequency_rank: '7', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'incredible, support, 12th man, push us' },
    { active: 'TRUE', question_id: 'Q008', question_en: 'Are you disappointed with the result / performance?', question_ko: '오늘 결과/경기력에 실망하셨나요?', pattern_type: 'defensive', primary_tags: 'result,emotion', difficulty: '1', followup_group_id: 'FUP_02', frequency_rank: '8', min_level: 'L1', scenario_tags: 'LST,DRW', hint_keywords: 'massively, mistakes, move on, bounce back' },
    { active: 'TRUE', question_id: 'Q009', question_en: 'What was the game plan going into this match?', question_ko: '이번 경기에 임하면서 준비한 전술적 계획은 무엇이었나요?', pattern_type: 'tactical', primary_tags: 'gameplan,tactics', difficulty: '2', followup_group_id: 'FUP_01', frequency_rank: '9', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'compact, transition, press, wide' },
    { active: 'TRUE', question_id: 'Q010', question_en: 'What did you see as the big differences between the first half and the second half?', question_ko: '전반전과 후반전의 가장 큰 차이점은 무엇이었다고 보시나요?', pattern_type: 'tactical', primary_tags: 'analysis,comparison', difficulty: '3', followup_group_id: '', frequency_rank: '10', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'intensity, shape, momentum, clinical' },
    { active: 'TRUE', question_id: 'Q011', question_en: 'How difficult was it playing with 10 men?', question_ko: '퇴장 이후 10명으로 경기를 치르는 것이 얼마나 어려웠나요?', pattern_type: 'emotional', primary_tags: 'pressure,adversity', difficulty: '2', followup_group_id: '', frequency_rank: '11', min_level: 'L1', scenario_tags: 'LST,DRW', hint_keywords: 'tough, reorganise, dig in, credit' },
    { active: 'TRUE', question_id: 'Q012', question_en: 'How do you cope with the busy schedule and fatigue?', question_ko: '빡빡한 경기 일정과 피로도를 어떻게 대처하고 있나요?', pattern_type: 'positive', primary_tags: 'fitness,mentality', difficulty: '2', followup_group_id: '', frequency_rank: '12', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'recovery, rotation, manage, depth' },
    { active: 'TRUE', question_id: 'Q013', question_en: 'How important is it to keep a clean sheet?', question_ko: '무실점(클린 시트)을 기록한 것이 얼마나 중요한가요?', pattern_type: 'tactical', primary_tags: 'defence,performance', difficulty: '1', followup_group_id: '', frequency_rank: '13', min_level: 'L1', scenario_tags: 'WIN,DRW', hint_keywords: 'foundation, confidence, whole team, shutout' },
    { active: 'TRUE', question_id: 'Q014', question_en: 'What was your view on the penalty / VAR decision?', question_ko: '페널티킥이나 VAR 판정에 대해 어떻게 생각하시나요?', pattern_type: 'defensive', primary_tags: 'decision,referee', difficulty: '2', followup_group_id: 'FUP_03', frequency_rank: '14', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'harsh, correct, move on, ref' },
    { active: 'TRUE', question_id: 'Q015', question_en: 'How pleased are you with the individual performance today?', question_ko: '오늘 개인 활약에 대해 어떻게 평가하시나요?', pattern_type: 'positive', primary_tags: 'performance,teammate', difficulty: '1', followup_group_id: '', frequency_rank: '15', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'outstanding, clinical, maturity, contribution' },
    { active: 'TRUE', question_id: 'Q016', question_en: 'How are you finding your new positional role?', question_ko: '새로운 포지션/역할을 소화하는 것은 어떤가요?', pattern_type: 'emotional', primary_tags: 'role,adaptation', difficulty: '2', followup_group_id: '', frequency_rank: '16', min_level: 'L1', scenario_tags: 'PRS,ALL', hint_keywords: 'getting used to, freedom, instructions, comfortable' },
    { active: 'TRUE', question_id: 'Q017', question_en: 'Where does this leave you in the title race / top 4 battle?', question_ko: '이 결과로 우승 경쟁이나 탑 4 경쟁에서 어느 위치에 놓이게 되었나요?', pattern_type: 'tactical', primary_tags: 'standings,competition', difficulty: '3', followup_group_id: '', frequency_rank: '17', min_level: 'L2', scenario_tags: 'WIN,LST', hint_keywords: 'gap, rivals, belief, focus' },
    { active: 'TRUE', question_id: 'Q018', question_en: 'Did you expect that sort of physically intense game?', question_ko: '그렇게 강도 높은 경기를 예상하셨나요?', pattern_type: 'emotional', primary_tags: 'intensity,opponent', difficulty: '2', followup_group_id: '', frequency_rank: '18', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'knew, battle, physical, prepared' },
    { active: 'TRUE', question_id: 'Q019', question_en: 'Does this win give you momentum going forward?', question_ko: '이번 승리가 앞으로 나아갈 모멘텀을 주나요?', pattern_type: 'positive', primary_tags: 'momentum,confidence', difficulty: '1', followup_group_id: '', frequency_rank: '19', min_level: 'L1', scenario_tags: 'WIN', hint_keywords: 'definitely, springboard, confidence, building' },
    { active: 'TRUE', question_id: 'Q020', question_en: 'How proud are you of the young players stepping up?', question_ko: '어린 선수들이 활약한 것이 얼마나 자랑스러운가요?', pattern_type: 'positive', primary_tags: 'academy,team', difficulty: '2', followup_group_id: '', frequency_rank: '20', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'fearless, future, talent, opportunity' },
    { active: 'TRUE', question_id: 'Q021', question_en: 'Can you explain the tactical tweaks you made?', question_ko: '오늘 전술적으로 어떤 변화를 주었는지 설명해주실 수 있나요?', pattern_type: 'tactical', primary_tags: 'tactics,adjustment', difficulty: '3', followup_group_id: '', frequency_rank: '21', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'shape, switch, back three, overload' },
    { active: 'TRUE', question_id: 'Q022', question_en: 'What are your ambitions for the rest of the season?', question_ko: '남은 시즌 목표는 무엇인가요?', pattern_type: 'positive', primary_tags: 'season,ambition', difficulty: '1', followup_group_id: '', frequency_rank: '22', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'trophy, top four, consistency, improve' },
    { active: 'TRUE', question_id: 'Q023', question_en: 'How are the new signings settling in?', question_ko: '새로운 영입생들은 어떻게 적응하고 있나요?', pattern_type: 'positive', primary_tags: 'squad,adaptation', difficulty: '1', followup_group_id: '', frequency_rank: '23', min_level: 'L1', scenario_tags: 'PRS,ALL', hint_keywords: 'seamless, quality, fitting in, excited' },
    { active: 'TRUE', question_id: 'Q024', question_en: 'Is this a missed opportunity?', question_ko: '이번 경기가 기회를 놓친 것인가요?', pattern_type: 'defensive', primary_tags: 'result,reflection', difficulty: '2', followup_group_id: '', frequency_rank: '24', min_level: 'L1', scenario_tags: 'LST,DRW', hint_keywords: 'points, look ahead, next game, frustrating' },
    { active: 'TRUE', question_id: 'Q025', question_en: 'What does it mean to wear the captain\'s armband for this club?', question_ko: '이 클럽에서 주장 완장을 차는 것은 어떤 의미인가요?', pattern_type: 'emotional', primary_tags: 'leadership,club', difficulty: '2', followup_group_id: '', frequency_rank: '25', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'honour, responsibility, privilege, standards' },
    { active: 'TRUE', question_id: 'Q026', question_en: 'How much do you work on set-pieces in training?', question_ko: '훈련 때 세트피스 연습을 얼마나 하나요?', pattern_type: 'tactical', primary_tags: 'training,setpiece', difficulty: '2', followup_group_id: '', frequency_rank: '26', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'hours, detail, routine, delivery' },
    { active: 'TRUE', question_id: 'Q027', question_en: 'How do you handle the pressure of these big games?', question_ko: '이런 큰 경기의 압박감을 어떻게 대처하시나요?', pattern_type: 'emotional', primary_tags: 'pressure,mentality', difficulty: '2', followup_group_id: '', frequency_rank: '27', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'experience, excited, thrive, block out' },
    { active: 'TRUE', question_id: 'Q028', question_en: 'How did you mentally deal with your recent injury setbacks?', question_ko: '최근 부상을 정신적으로 어떻게 극복하셨나요?', pattern_type: 'emotional', primary_tags: 'injury,mentality', difficulty: '2', followup_group_id: '', frequency_rank: '28', min_level: 'L2', scenario_tags: 'PRS,ALL', hint_keywords: 'rehab, focus, stronger, reset' },
    { active: 'TRUE', question_id: 'Q029', question_en: "What are your thoughts on the opponent's performance?", question_ko: '오늘 상대 팀의 경기력에 대해 어떻게 생각하시나요?', pattern_type: 'tactical', primary_tags: 'opponent,analysis', difficulty: '2', followup_group_id: '', frequency_rank: '29', min_level: 'L2', scenario_tags: 'ALL', hint_keywords: 'dangerous, threat, credit, deserved' },
    { active: 'TRUE', question_id: 'Q030', question_en: 'What is your message to the supporters?', question_ko: '팬들에게 전하고 싶은 메시지는 무엇인가요?', pattern_type: 'positive', primary_tags: 'fans,message', difficulty: '1', followup_group_id: '', frequency_rank: '30', min_level: 'L1', scenario_tags: 'ALL', hint_keywords: 'thank you, together, stick with us, proud' },
];

const followups = [
    { active: 'TRUE', followup_id: 'FUP_01_A', followup_group_id: 'FUP_01', followup_en: 'Will you change the tactical approach in the next game based on what you saw today?', followup_ko: '오늘 경기 내용을 바탕으로 다음 경기 전술에 변화가 있을까요?', difficulty: '3' },
    { active: 'TRUE', followup_id: 'FUP_02_A', followup_group_id: 'FUP_02', followup_en: "How do you plan to lift the team's spirits before the upcoming match?", followup_ko: '다가오는 경기를 앞두고 팀 분위기를 어떻게 끌어올리실 계획이신가요?', difficulty: '2' },
    { active: 'TRUE', followup_id: 'FUP_03_A', followup_group_id: 'FUP_03', followup_en: 'Do you think there needs to be more transparency in how VAR decisions are communicated?', followup_ko: 'VAR 판정 결과를 전달하는 과정에 더 큰 투명성이 필요하다고 생각하시나요?', difficulty: '3' },
];

async function seedSheet(sheet, rows, label) {
    const existing = await sheet.getRows();
    if (existing.length > 0 && !FORCE) {
        console.log(`ℹ️  ${label} already has ${existing.length} rows. Use --force to re-seed.`);
        return;
    }
    if (existing.length > 0 && FORCE) {
        console.log(`🗑️  Clearing ${existing.length} existing rows from ${label}...`);
        // Delete all rows
        for (const row of existing) {
            await row.delete();
        }
        console.log(`✅ Cleared ${label}.`);
    }
    console.log(`⏳ Seeding ${label} (${rows.length} rows)...`);
    await sheet.addRows(rows);
    console.log(`✅ ${label} seeded successfully.`);
}

async function main() {
    try {
        await doc.loadInfo();
        console.log(`📄 Loaded doc: ${doc.title}`);

        // 1. InterviewQuestions
        const qSheet = doc.sheetsByTitle['InterviewQuestions'];
        if (qSheet) {
            await seedSheet(qSheet, questions, 'InterviewQuestions');
        } else {
            console.log('❌ InterviewQuestions sheet not found. Please create it first.');
        }

        // 2. InterviewFollowups
        const fSheet = doc.sheetsByTitle['InterviewFollowups'];
        if (fSheet) {
            await seedSheet(fSheet, followups, 'InterviewFollowups');
        } else {
            console.log('❌ InterviewFollowups sheet not found. Skipping.');
        }

        console.log('\n🎉 Done. Run the interview API again to verify.');
    } catch (e) {
        console.error('Error during seeding:', e);
        process.exit(1);
    }
}

main();
