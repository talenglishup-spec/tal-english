/**
 * TAL — Google Sheets client
 * Path: src/lib/sheets.ts
 *
 * Google Sheet "Clips" 탭 컬럼 순서 (정확히 일치해야 함):
 *   active | clip_id | title_ko | title_en | youtube_url | player_name
 *   position_tag | type | subtype
 *   start_sec | end_sec | speak_mode | pause_at | target_phrase
 *   nuance_desc | similar_expressions | audio_explanation_url
 *   tags | notes
 *
 * 변경 이력:
 *   - context_tag 제거 → type(대분류)으로 대체
 *   - start_sec, end_sec 추가 (useYouTubePlayer의 startAt/endAt에 대응)
 *   - cloze 관련 필드 제거 (Shorts Speak Mode로 대체)
 *   - Scope: spreadsheets (읽기+쓰기, Phase 6 어드민 자동화용)
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ── Auth ──────────────────────────────────────────────────────
const SHEET_ID      = process.env.GOOGLE_SHEET_ID!;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const rawKey        = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY   = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

// 읽기+쓰기 스코프: Phase 6 어드민 자동화(audio_url, pause_at 기입)에 필요
const auth = new JWT({
    email:  SERVICE_EMAIL,
    key:    PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

// ── Types ─────────────────────────────────────────────────────
export type PositionTag = 'FW' | 'MF' | 'DF' | 'GK' | 'ALL';

/** 대분류: 필터 탭 기준 */
export type ClipType =
    | 'interview'   // 인터뷰 (기자회견, 경기 후)
    | 'training'    // 훈련 (전술, 입단 첫날)
    | 'match'       // 경기 중
    | 'off_pitch';  // 경기 외 (계약, 라커룸)

/** 소분류: 세부 상황 */
export type ClipSubtype =
    | 'post_match'        // 경기 후 인터뷰
    | 'press_conference'  // 기자 회견
    | 'tactical'          // 감독과 전술
    | 'first_day'         // 입단 첫날
    | 'signing'           // 계약 체결
    | 'locker_room';      // 라커룸

export type ClipItem = {
    clip_id:     string;
    title_ko:    string;
    title_en:    string;
    youtube_url: string;    // https://youtu.be/xxxxx 또는 https://youtube.com/watch?v=xxxxx
    player_name: string;

    // 분류
    position_tag: PositionTag;
    type:         ClipType;     // 대분류 (탭 필터)
    subtype:      ClipSubtype;  // 소분류 (세부 필터)

    // 재생 구간
    start_sec: number;  // 클립 시작 시점 (영상 전체 중 관련 구간 시작)
    end_sec:   number;  // 클립 종료 시점 (2/3단계 루프 종료점)

    // Speak mode
    speak_mode:    boolean;  // true = pauseAt에서 자동 정지 후 말하기 도전
    pause_at:      number;   // 정지 시점 (start_sec ~ end_sec 사이)
    target_phrase: string;   // 선수가 말하는 영어 문장

    // 뉘앙스 설명 팝업
    nuance_desc:           string;  // 한국어 뉘앙스 설명
    similar_expressions:   string;  // 유사 표현 (콤마 구분)
    audio_explanation_url: string;  // ElevenLabs TTS 오디오 URL

    // 메타
    tags:  string;
    notes: string;
};

// ── Time parsing ──────────────────────────────────────────────
/**
 * 구글 시트에서 시간 셀로 서식된 값("3:20", "1:03:20")과 순수 초 단위 숫자
 * 문자열("200")을 모두 초 단위 숫자로 변환한다.
 * parseFloat("3:20")은 콜론 이전의 "3"만 읽어버려 분:초 구간이 통째로
 * 잘못 인식되는 문제가 있어 별도 파서로 처리한다.
 */
function parseSeconds(raw: string | undefined): number {
    if (!raw) return 0;
    const str = String(raw).trim();
    if (!str) return 0;
    if (!str.includes(':')) return parseFloat(str) || 0;

    const parts = str.split(':').map(p => Number(p.trim()));
    if (parts.some(p => Number.isNaN(p))) return 0;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// ── In-memory cache ───────────────────────────────────────────
let _cache: ClipItem[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 60초 인스턴스 캐시

// ── getClipItems ──────────────────────────────────────────────
export async function getClipItems(): Promise<ClipItem[]> {
    if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
        return _cache;
    }

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Clips'];
        if (!sheet) {
            console.warn('[TAL] "Clips" sheet not found');
            return _cache || [];
        }

        const rows = await sheet.getRows();

        const items: ClipItem[] = rows
            .map(row => {
                const activeVal = row.get('active');
                const isActive  = activeVal === 'TRUE' || activeVal === true || activeVal === 'true';
                if (!isActive) return null;

                const speakVal  = row.get('speak_mode');
                const speakMode = speakVal === 'TRUE' || speakVal === true || speakVal === 'true';

                return {
                    clip_id:     row.get('clip_id')     || '',
                    title_ko:    row.get('title_ko')    || '',
                    title_en:    row.get('title_en')    || '',
                    youtube_url: row.get('youtube_url') || '',
                    player_name: row.get('player_name') || '',

                    position_tag: (row.get('position_tag') || 'ALL')        as PositionTag,
                    type:         (row.get('type')         || 'interview')   as ClipType,
                    subtype:      (row.get('subtype')      || 'post_match')  as ClipSubtype,

                    start_sec: parseSeconds(row.get('start_sec')),
                    end_sec:   parseSeconds(row.get('end_sec')),

                    speak_mode:    speakMode,
                    pause_at:      parseSeconds(row.get('pause_at')),
                    target_phrase: row.get('target_phrase') || '',

                    nuance_desc:           row.get('nuance_desc')           || '',
                    similar_expressions:   row.get('similar_expressions')   || '',
                    audio_explanation_url: row.get('audio_explanation_url') || '',

                    tags:  row.get('tags')  || '',
                    notes: row.get('notes') || '',
                } satisfies ClipItem;
            })
            .filter((item): item is ClipItem => item !== null);

        _cache     = items;
        _cacheTime = Date.now();
        return items;

    } catch (error) {
        console.error('[TAL] Error fetching Google Sheets items:', error);
        return _cache || [];
    }
}

// ── Filter helpers ────────────────────────────────────────────
export function filterByPosition(items: ClipItem[], position: PositionTag): ClipItem[] {
    if (position === 'ALL') return items;
    return items.filter(i => i.position_tag === position || i.position_tag === 'ALL');
}

export function filterByType(items: ClipItem[], type: ClipType): ClipItem[] {
    return items.filter(i => i.type === type);
}

export function filterBySubtype(items: ClipItem[], subtype: ClipSubtype): ClipItem[] {
    return items.filter(i => i.subtype === subtype);
}

export function filterBySpeakMode(items: ClipItem[], speakOnly: boolean): ClipItem[] {
    if (!speakOnly) return items;
    return items.filter(i => i.speak_mode && i.pause_at > 0 && i.target_phrase);
}

// ── YouTube URL → Video ID ────────────────────────────────────
/**
 * 지원 형식:
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const patterns = [
        /youtu\.be\/([^?&]+)/,
        /[?&]v=([^?&]+)/,
        /\/shorts\/([^?&]+)/,
    ];
    for (const re of patterns) {
        const m = url.match(re);
        if (m) return m[1];
    }
    return null;
}

// ── addClipItem (Google Sheets Insert Row) ────────────────────
export async function addClipItem(item: Omit<ClipItem, 'speak_mode'> & { speak_mode: boolean }): Promise<boolean> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Clips'];
        if (!sheet) {
            console.error('[TAL] "Clips" sheet not found for insertion');
            return false;
        }

        await sheet.addRow({
            active: 'TRUE',
            clip_id: item.clip_id,
            title_ko: item.title_ko,
            title_en: item.title_en,
            youtube_url: item.youtube_url,
            player_name: item.player_name,
            position_tag: item.position_tag,
            type: item.type,
            subtype: item.subtype,
            start_sec: String(item.start_sec),
            end_sec: String(item.end_sec),
            speak_mode: item.speak_mode ? 'TRUE' : 'FALSE',
            pause_at: String(item.pause_at),
            target_phrase: item.target_phrase,
            nuance_desc: item.nuance_desc,
            similar_expressions: item.similar_expressions,
            audio_explanation_url: item.audio_explanation_url,
            tags: item.tags,
            notes: item.notes
        });

        // 인메모리 캐시 무효화
        _cache = null;
        return true;
    } catch (error) {
        console.error('[TAL] Error appending row to Google Sheets:', error);
        return false;
    }
}

