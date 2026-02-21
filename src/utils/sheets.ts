import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Config
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// Handle private key: robustly parse assuming it might have extra quotes or literal \n
const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.warn("Missing Google Sheets credentials in environment variables.");
} else {
    // Log loaded config safely if needed
}

const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID as string, auth);

// --- Existing Types ---
// --- Existing Types ---
export type AttemptRow = {
    attempt_id: string;
    date_time: string;
    player_id: string;
    session_id: string;
    session_mode: 'challenge' | 'practice';
    item_id: string;
    challenge_type: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';

    stt_text: string;
    audio_url: string;
    duration_sec: number;
    time_to_first_response_ms: number;

    ai_score: number;
    coach_score?: string;
    coach_feedback?: string;
    measurement_type?: string;

    question_play_count: number;
    model_play_count: number;
    translation_toggle_count: number;
    answer_revealed: boolean;
};

export type TrainingItem = {
    id: string; // item_id
    level: string;
    category: string;
    sub_category: string;
    prompt_kr: string; // prompt_kr
    target_en: string; // target_en
    focus_point: string;
    coach_note: string;
    active: boolean;
    model_audio_url: string;
    audio_source: string;
    // New Fields v5
    practice_type: 'A' | 'B'; // A=3-Step, B=1-Step Cloze
    cloze_target: string; // text to hide for Type B
    challenge_type: 'FOOTBALL_KO_TO_EN' | 'FOOTBALL_ENQ_TO_EN' | 'INTERVIEW_ENQ_TO_EN';
    question_text: string;
    question_audio_url: string;
    question_audio_en?: string;
    question_audio_source?: 'tts' | 'manual' | 'external';
};

// --- New Type for Materials (Global Library) ---
export type ClassMaterial = {
    material_id: string;
    title: string;
    type: 'video' | 'doc' | 'link';
    url: string;
    note: string;
    active: boolean;
    // date_added removed per strict v4 spec
};

export type PlayerRow = {
    player_id: string;
    player_name: string;
    password?: string;
    active: boolean;
    note: string;
    created_at?: string;
};

// --- Helper ---
export async function getSheet(title: string) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[title];
        return sheet;
    } catch (e) {
        console.error('Error loading Google Sheet doc:', e);
        throw e;
    }
}

export async function getAttemptsSheet() {
    const sheet = await getSheet('Attempts');
    if (!sheet) return doc.sheetsByIndex[0];
    return sheet;
}

// --- Player Functions ---

export async function getPlayer(playerId: string): Promise<PlayerRow | null> {
    const sheet = await getSheet('Players');
    if (!sheet) return null;

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('player_id') === playerId);

    if (!row) return null;

    const activeVal = row.get('active');
    const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';

    if (!isActive) return null;

    return {
        player_id: row.get('player_id'),
        player_name: row.get('player_name'),
        password: row.get('password'),
        active: isActive,
        note: row.get('note') || '',
        created_at: row.get('created_at')
    };
}

// --- Exising Functions Updated ---

export async function getItems(): Promise<TrainingItem[]> {
    const sheet = await getSheet('Items');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
        .map((row) => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';

            return {
                id: row.get('item_id'), // Mapped from item_id
                level: row.get('level') || '',
                category: row.get('category') || '',
                sub_category: row.get('sub_category') || '',
                prompt_kr: row.get('prompt_kr') || '',
                target_en: row.get('target_en') || '',
                focus_point: row.get('focus_point') || '',
                coach_note: row.get('coach_note') || '',
                active: isActive,
                model_audio_url: row.get('model_audio_url_en') || '',
                audio_source: row.get('audio_source_en') || '',
                // New Fields v5
                practice_type: (row.get('practice_type') as any) || 'A',
                cloze_target: row.get('cloze_target') || '',
                challenge_type: (row.get('challenge_type') as any) || 'FOOTBALL_KO_TO_EN',
                question_text: row.get('question_text') || '',
                question_audio_url: row.get('question_audio') || '', // Note: column name 'question_audio' maps to property 'question_audio_url'
                question_audio_en: row.get('question_audio_en') || '',
                question_audio_source: row.get('question_audio_source') || ''
            };
        })
        .filter(item => item.active === true);
}

export async function appendAttempt(data: AttemptRow) {
    const sheet = await getAttemptsSheet();
    await sheet.addRow({
        attempt_id: data.attempt_id,
        date_time: data.date_time,
        player_id: data.player_id,
        session_id: data.session_id,
        session_mode: data.session_mode,
        item_id: data.item_id,
        challenge_type: data.challenge_type,

        stt_text: data.stt_text,
        audio_url: data.audio_url,
        duration_sec: data.duration_sec,
        time_to_first_response_ms: data.time_to_first_response_ms,

        ai_score: data.ai_score,
        coach_score: data.coach_score || '',
        coach_feedback: data.coach_feedback || '',
        measurement_type: data.measurement_type || '',

        question_play_count: data.question_play_count || 0,
        model_play_count: data.model_play_count || 0,
        translation_toggle_count: data.translation_toggle_count || 0,
        answer_revealed: data.answer_revealed || false
    });
}

export async function getAttempts(): Promise<AttemptRow[]> {
    const sheet = await getAttemptsSheet();
    const rows = await sheet.getRows();
    return rows.map((row) => ({
        attempt_id: row.get('attempt_id'),
        date_time: row.get('date_time'),
        player_id: row.get('player_id'),
        session_id: row.get('session_id'),
        session_mode: row.get('session_mode') as 'challenge' | 'practice',
        item_id: row.get('item_id'),
        challenge_type: row.get('challenge_type') as any,

        stt_text: row.get('stt_text'),
        audio_url: row.get('audio_url'),
        duration_sec: Number(row.get('duration_sec') || 0),
        time_to_first_response_ms: Number(row.get('time_to_first_response_ms') || 0),

        ai_score: Number(row.get('ai_score')),
        coach_score: row.get('coach_score'),
        coach_feedback: row.get('coach_feedback'),
        measurement_type: row.get('measurement_type'),

        question_play_count: Number(row.get('question_play_count') || 0),
        model_play_count: Number(row.get('model_play_count') || 0),
        translation_toggle_count: Number(row.get('translation_toggle_count') || 0),
        answer_revealed: row.get('answer_revealed') === 'TRUE' || row.get('answer_revealed') === 'true' || row.get('answer_revealed') === true
    })).reverse();
}

export async function updateAttempt(attemptId: string, updates: Partial<AttemptRow>): Promise<boolean> {
    const sheet = await getAttemptsSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('attempt_id') === attemptId);

    if (!row) {
        return false;
    }

    if (updates.coach_score !== undefined) row.set('coach_score', updates.coach_score);
    if (updates.coach_feedback !== undefined) row.set('coach_feedback', updates.coach_feedback);
    if (updates.ai_score !== undefined) row.set('ai_score', updates.ai_score.toString());

    await row.save();
    return true;
}

// --- Materials Functions (Global Library) ---

export async function getMaterials(): Promise<ClassMaterial[]> {
    const sheet = await getSheet('Materials');
    if (!sheet) {
        console.warn('Materials sheet not found');
        return [];
    }
    const rows = await sheet.getRows();
    return rows
        .map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                material_id: row.get('material_id'),
                title: row.get('title'),
                type: row.get('type') as 'video' | 'doc' | 'link',
                url: row.get('url'),
                note: row.get('note') || '',
                active: isActive
            };
        })
        .filter(m => m.active)
        .reverse();
}

export async function addMaterial(material: ClassMaterial) {
    const sheet = await getSheet('Materials');
    if (!sheet) throw new Error('Materials sheet not found');

    await sheet.addRow({
        material_id: material.material_id,
        title: material.title,
        type: material.type,
        url: material.url,
        note: material.note,
        active: material.active
    });
}

// ... Lesson Functions ...

export async function getStructuredLessonContent(lessonId: string): Promise<StructuredLessonContent[]> {
    const [situations, allSitItems, allItems] = await Promise.all([
        getLessonSituations(lessonId),
        getAllSituationItems(),
        getItems()
    ]);

    // 1. Build Item Map
    const itemMap = new Map<string, TrainingItem>();
    allItems.forEach(i => itemMap.set(i.id, i));

    // 2. Build Result (Relying on SituationItems as authority)
    const results: StructuredLessonContent[] = [];

    for (const sit of situations) {
        // Find items for this situation
        const sitItems = allSitItems
            .filter(si => si.situation_id === sit.situation_id)
            .sort((a, b) => a.item_order - b.item_order);

        const items: TrainingItem[] = [];
        for (const si of sitItems) {
            // Check validity: Item must exist (Global Dict)
            if (itemMap.has(si.item_id)) {
                const item = itemMap.get(si.item_id)!;
                items.push(item);
            }
        }

        if (items.length > 0) {
            results.push({
                situation: sit,
                items: items
            });
        }
    }

    return results;
}

// --- Lessons & LessonItems (Player Assignment) ---

export type LessonRow = {
    lesson_id: string;
    player_id: string;
    lesson_no: number;
    lesson_date: string;
    note: string;
    active: boolean;
};

export type LessonItemRow = {
    lesson_id: string;
    item_id: string;
    active: boolean;
};

export type LessonSituationRow = {
    situation_id: string;
    lesson_id: string;
    situation_title_ko: string;
    situation_order: number;
    active: boolean;
    note: string;
};

export type SituationItemRow = {
    situation_id: string;
    item_id: string;
    item_order: number;
    active: boolean;
    note: string;
};

// Relation: Lesson <-> Materials
export type LessonMaterialRow = {
    lesson_id: string;
    material_id: string;
    material_order: number;
    active: boolean;
    note: string;
};

export async function getLessons(playerId?: string): Promise<LessonRow[]> {
    const sheet = await getSheet('Lessons');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
        .map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                lesson_id: row.get('lesson_id'),
                player_id: row.get('player_id'),
                lesson_no: Number(row.get('lesson_no')),
                lesson_date: row.get('lesson_date'),
                note: row.get('note') || '',
                active: isActive
            };
        })
        .filter(lesson => {
            if (!lesson.active) return false;
            if (playerId && lesson.player_id !== playerId) return false;
            return true;
        })
        .sort((a, b) => b.lesson_no - a.lesson_no);
}

// Check LessonItems for authority
export async function getLessonItems(lessonId?: string): Promise<LessonItemRow[]> {
    const sheet = await getSheet('LessonItems');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
        .map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                lesson_id: row.get('lesson_id'),
                item_id: row.get('item_id'),
                active: isActive
            };
        })
        .filter(li => li.active && (!lessonId || li.lesson_id === lessonId));
}

export async function getLessonMaterials(lessonId?: string): Promise<LessonMaterialRow[]> {
    const sheet = await getSheet('LessonMaterials');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
        .map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                lesson_id: row.get('lesson_id'),
                material_id: row.get('material_id'),
                material_order: Number(row.get('material_order') || 0),
                active: isActive,
                note: row.get('note') || ''
            };
        })
        .filter(lm => lm.active && (!lessonId || lm.lesson_id === lessonId))
        .sort((a, b) => a.material_order - b.material_order);
}

// Helper: Get full material objects for a lesson
export async function getMaterialsForLesson(lessonId: string): Promise<ClassMaterial[]> {
    const [allMaterials, lessonLinks] = await Promise.all([
        getMaterials(),
        getLessonMaterials(lessonId)
    ]);

    // Create map for order and checking existence
    const linkMap = new Map<string, number>();
    lessonLinks.forEach(l => linkMap.set(l.material_id, l.material_order));

    return allMaterials
        .filter(m => linkMap.has(m.material_id)) // Must be linked
        .map(m => ({ ...m, order: linkMap.get(m.material_id) || 0 })) // Add order for sorting
        .sort((a, b) => a.order - b.order); // Sort by LessonMaterial order
}

// --- Situation Management ---

export async function getLessonSituations(lessonId: string): Promise<LessonSituationRow[]> {
    const sheet = await getSheet('LessonSituations');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
        .map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                situation_id: row.get('situation_id'),
                lesson_id: row.get('lesson_id'),
                situation_title_ko: row.get('situation_title_ko'),
                situation_order: Number(row.get('situation_order') || 0),
                active: isActive,
                note: row.get('note') || ''
            };
        })
        .filter(s => s.active && s.lesson_id === lessonId)
        .sort((a, b) => a.situation_order - b.situation_order);
}

export async function getAllSituationItems(): Promise<SituationItemRow[]> {
    const sheet = await getSheet('SituationItems');
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows.map(row => {
        const activeVal = row.get('active');
        const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
        return {
            situation_id: row.get('situation_id'),
            item_id: row.get('item_id'),
            item_order: Number(row.get('item_order') || 0),
            active: isActive,
            note: row.get('note') || ''
        };
    }).filter(si => si.active);
}

export type StructuredLessonContent = {
    situation: LessonSituationRow;
    items: TrainingItem[];
};


// Helper to get all unique active item IDs for a player (for Drills)
// Helper to get items with Lesson Context for a player
export type EnrichedItem = TrainingItem & {
    lesson_id: string;
    lesson_no: number;
    lesson_note: string;
};

export async function getPlayerItemsWithContext(playerId: string): Promise<EnrichedItem[]> {
    // 1. Get Player lessons
    const lessons = await getLessons(playerId);
    if (lessons.length === 0) return [];

    // Sort lessons early (descending usually, or ascending?)
    // User rule: "Practice... Lesson-first...". Usually implies logical order.
    // Let's keep existing sort: sort((a, b) => b.lesson_no - a.lesson_no) from getLessons?
    // getLessons sorts descending.

    const lessonMap = new Map<string, LessonRow>();
    lessons.forEach(l => lessonMap.set(l.lesson_id, l));
    const activeLessonIds = new Set(lessons.map(l => l.lesson_id));

    // 2. Get LessonSituations (Source of Truth for Lesson Content Structure)
    const sitSheet = await getSheet('LessonSituations');
    let allSituations: LessonSituationRow[] = [];
    if (sitSheet) {
        const rows = await sitSheet.getRows();
        allSituations = rows.map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                situation_id: row.get('situation_id'),
                lesson_id: row.get('lesson_id'),
                situation_title_ko: row.get('situation_title_ko'),
                situation_order: Number(row.get('situation_order') || 0),
                active: isActive,
                note: row.get('note') || ''
            };
        }).filter(s => s.active && activeLessonIds.has(s.lesson_id));
    }

    if (allSituations.length === 0) return [];

    // 3. Get SituationItems (Source of Truth for Items in Situation)
    const sitItemSheet = await getSheet('SituationItems');
    let allSitItems: SituationItemRow[] = [];
    if (sitItemSheet) {
        const rows = await sitItemSheet.getRows();
        allSitItems = rows.map(row => {
            const activeVal = row.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return {
                situation_id: row.get('situation_id'),
                item_id: row.get('item_id'),
                item_order: Number(row.get('item_order') || 0),
                active: isActive,
                note: row.get('note') || ''
            };
        }).filter(si => si.active);
    }

    // 4. Get Items Library
    const allItems = await getItems();
    const itemMap = new Map<string, TrainingItem>();
    allItems.forEach(i => itemMap.set(i.id, i));

    // 5. Build Result: Lesson -> Situation -> Item
    // We want flat list but ordered.
    // Sort Situations first
    allSituations.sort((a, b) => {
        const lA = lessonMap.get(a.lesson_id)!;
        const lB = lessonMap.get(b.lesson_id)!;
        if (lA.lesson_no !== lB.lesson_no) return lB.lesson_no - lA.lesson_no; // Descending lesson
        return a.situation_order - b.situation_order; // Ascending situation
    });

    const result: EnrichedItem[] = [];
    const sitMap = new Map(allSituations.map(s => [s.situation_id, s]));

    // Filter SituationItems by active situations
    const relevantSitItems = allSitItems.filter(si => sitMap.has(si.situation_id));

    // Group items by situation to sort them
    const itemsBySit = new Map<string, SituationItemRow[]>();
    relevantSitItems.forEach(si => {
        if (!itemsBySit.has(si.situation_id)) itemsBySit.set(si.situation_id, []);
        itemsBySit.get(si.situation_id)!.push(si);
    });

    // Iterate sorted situations to build final list
    for (const sit of allSituations) {
        const sitItems = itemsBySit.get(sit.situation_id) || [];
        sitItems.sort((a, b) => a.item_order - b.item_order); // Ascending item order

        const lesson = lessonMap.get(sit.lesson_id)!;

        for (const si of sitItems) {
            const item = itemMap.get(si.item_id);
            if (item) {
                result.push({
                    ...item,
                    lesson_id: lesson.lesson_id,
                    lesson_no: lesson.lesson_no,
                    lesson_note: lesson.note,
                    // We could add situation info here if EnrichedItem supports it
                });
            }
        }
    }

    return result;
}

export async function getAssignedItemIds(playerId: string): Promise<string[]> {
    const lessons = await getLessons(playerId);
    if (lessons.length === 0) return [];
    const lessonIds = new Set(lessons.map(l => l.lesson_id));

    // Use LessonSituations -> SituationItems
    const sitSheet = await getSheet('LessonSituations');
    const sitItemSheet = await getSheet('SituationItems');

    if (!sitSheet || !sitItemSheet) return [];

    const sitRows = await sitSheet.getRows();
    const activeSitRows = sitRows.filter(r => {
        const activeVal = r.get('active');
        const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
        return isActive && lessonIds.has(r.get('lesson_id'));
    });

    const situationIds = new Set(activeSitRows.map(r => r.get('situation_id')));

    const sitItemRows = await sitItemSheet.getRows();
    const assigned = sitItemRows
        .filter(r => {
            const activeVal = r.get('active');
            const isActive = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
            return isActive && situationIds.has(r.get('situation_id'));
        })
        .map(r => r.get('item_id'));

    return Array.from(new Set(assigned));
}

// --- Teacher Dashboard Functions ---

export async function addLesson(lesson: LessonRow) {
    const sheet = await getSheet('Lessons');
    if (!sheet) throw new Error('Lessons sheet not found');

    await sheet.addRow({
        lesson_id: lesson.lesson_id,
        player_id: lesson.player_id,
        lesson_no: lesson.lesson_no,
        lesson_date: lesson.lesson_date,
        note: lesson.note,
        active: lesson.active
    });
}

export async function addLessonItem(lessonId: string, itemId: string) {
    const sheet = await getSheet('LessonItems');
    if (!sheet) throw new Error('LessonItems sheet not found');

    await sheet.addRow({
        lesson_id: lessonId,
        item_id: itemId
    });
}

export async function addLessonMaterial(lessonId: string, materialId: string) {
    const sheet = await getSheet('LessonMaterials');
    if (!sheet) throw new Error('LessonMaterials sheet not found');

    await sheet.addRow({
        lesson_id: lessonId,
        material_id: materialId
    });
}

export async function deleteLessonItem(lessonId: string, itemId: string) {
    const sheet = await getSheet('LessonItems');
    if (!sheet) throw new Error('LessonItems sheet not found');

    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('lesson_id') === lessonId && r.get('item_id') === itemId);
    if (rowToDelete) {
        await rowToDelete.delete();
    }
}

export async function deleteLessonMaterial(lessonId: string, materialId: string) {
    const sheet = await getSheet('LessonMaterials');
    if (!sheet) throw new Error('LessonMaterials sheet not found');

    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('lesson_id') === lessonId && r.get('material_id') === materialId);
    if (rowToDelete) {
        await rowToDelete.delete();
    }
}

// --- Item Management (Update) ---

export async function updateItem(itemId: string, updates: Partial<TrainingItem>) {
    const sheet = await getSheet('Items');
    if (!sheet) throw new Error('Items sheet not found');

    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('item_id') === itemId);

    if (!row) {
        throw new Error(`Item with ID ${itemId} not found`);
    }

    // Update fields if they exist in updates
    if (updates.model_audio_url !== undefined) row.set('model_audio_url_en', updates.model_audio_url);
    if (updates.audio_source !== undefined) row.set('audio_source_en', updates.audio_source);

    // Support other updates if needed
    if (updates.target_en !== undefined) row.set('target_en', updates.target_en);
    if (updates.prompt_kr !== undefined) row.set('prompt_kr', updates.prompt_kr);

    // New Fields v5
    if (updates.practice_type !== undefined) row.set('practice_type', updates.practice_type);
    if (updates.cloze_target !== undefined) row.set('cloze_target', updates.cloze_target);
    if (updates.challenge_type !== undefined) row.set('challenge_type', updates.challenge_type);
    if (updates.question_text !== undefined) row.set('question_text', updates.question_text);
    if (updates.question_audio_url !== undefined) row.set('question_audio', updates.question_audio_url); // map back to col name
    if (updates.question_audio_en !== undefined) row.set('question_audio_en', updates.question_audio_en);
    if (updates.question_audio_source !== undefined) row.set('question_audio_source', updates.question_audio_source);

    await row.save();
}
