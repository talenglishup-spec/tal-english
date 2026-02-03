import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Config
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Handle newline characters

if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    // Warn but don't crash on build (might be missing in CI/local dev initially)
    console.warn("Missing Google Sheets credentials in environment variables.");
}

const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID as string, auth);

export type AttemptRow = {
    attempt_id: string;
    date_time: string;
    player_id: string;
    player_name: string;
    item_id: string;
    situation: string;
    target_en: string;
    stt_text: string;
    ai_score: number;
    audio_url: string;
    coach_score?: string;
    coach_feedback?: string;
};

// Helper to get specific sheet
export async function getSheet(title: string) {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[title];
    return sheet;
}

export async function getAttemptsSheet() {
    const sheet = await getSheet('Attempts');
    if (!sheet) return doc.sheetsByIndex[0]; // Fallback
    return sheet;
}

export type TrainingItem = {
    id: string;
    level: string;
    category: string;
    situation: string; // prompt_kr
    target_en: string; // target_en
    allowed_variations: string[];
    key_word: string;
    focus_point: string;
    coach_note: string;
    active: boolean;
};

export async function getItems(): Promise<TrainingItem[]> {
    const sheet = await getSheet('Items');
    if (!sheet) {
        console.warn('Items sheet not found');
        return [];
    }

    const rows = await sheet.getRows();
    return rows
        .map((row) => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true'; // robust check

            const variationsRaw = row.get('allowed_variations') || '';
            const variations = variationsRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

            return {
                id: row.get('item_id'),
                level: row.get('level') || '',
                category: row.get('category') || '',
                situation: row.get('prompt_kr'),
                target_en: row.get('target_en'),
                allowed_variations: variations,
                key_word: row.get('key_word') || '',
                focus_point: row.get('focus_point') || '',
                coach_note: row.get('coach_note') || '',
                active: isActive
            };
        })
        .filter(item => item.active === true);
}

export async function appendAttempt(data: AttemptRow) {
    const sheet = await getAttemptsSheet();
    // Convert strictly to string/number/boolean for sheets
    await sheet.addRow({
        attempt_id: data.attempt_id,
        date_time: data.date_time,
        player_id: data.player_id,
        player_name: data.player_name,
        item_id: data.item_id,
        situation: data.situation,
        target_en: data.target_en,
        stt_text: data.stt_text,
        ai_score: data.ai_score,
        audio_url: data.audio_url,
        coach_score: data.coach_score || '',
        coach_feedback: data.coach_feedback || ''
    });
}

export async function getAttempts(): Promise<AttemptRow[]> {
    const sheet = await getAttemptsSheet();
    const rows = await sheet.getRows();

    return rows.map((row) => ({
        attempt_id: row.get('attempt_id'),
        date_time: row.get('date_time'),
        player_id: row.get('player_id'),
        player_name: row.get('player_name'),
        item_id: row.get('item_id'),
        situation: row.get('situation'),
        target_en: row.get('target_en'),
        stt_text: row.get('stt_text'),
        ai_score: Number(row.get('ai_score')),
        audio_url: row.get('audio_url'),
        coach_score: row.get('coach_score'),
        coach_feedback: row.get('coach_feedback'),
    })).reverse(); // Newest first usually
}

export async function updateAttempt(attemptId: string, updates: { coach_score: string; coach_feedback: string }) {
    const sheet = await getAttemptsSheet();
    const rows = await sheet.getRows();

    const row = rows.find(r => r.get('attempt_id') === attemptId);
    if (row) {
        row.assign(updates);
        await row.save();
        return true;
    }
    return false;
}
