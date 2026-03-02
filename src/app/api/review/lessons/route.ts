import { NextResponse } from 'next/server';
import { getLessons, getAttempts, getLessonSituations, getAllSituationItems } from '@/utils/sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'playerId is required' }, { status: 400 });
        }

        // 1. Fetch Lessons for Player
        const lessons = await getLessons(playerId);

        // 2. Fetch Attempts to compute progress
        // Filter attempts for this player, optionally where status = 'finalized'
        const attempts = await getAttempts();
        const playerAttempts = attempts.filter(a => a.player_id === playerId);
        const finalizedAttempts = playerAttempts.filter(a => a.status === 'finalized' || a.status === undefined);

        // Map item_id -> latest finalized attempt
        const lastFinalizedAtMap = new Map<string, Date>();
        finalizedAttempts.forEach(a => {
            const date = new Date(a.date_time || a.created_at || '');
            if (!isNaN(date.getTime())) {
                const existing = lastFinalizedAtMap.get(a.item_id);
                if (!existing || date > existing) {
                    lastFinalizedAtMap.set(a.item_id, date);
                }
            }
        });

        // 3. To compute progress per lesson, we need to know the items in each lesson.
        // We do this by getting LessonSituations and SituationItems.
        const allSituations = await getLessonSituations(''); // Wait, getLessonSituations filters by lessonId. We need all.
        // Let's create a custom logic to get all LessonSituations without filtering lessonId, or we just map everything efficiently.
        // Let's modify our approach. It might be faster to fetch the RAW rows for LessonSituations.
        // Actually, instead of altering getLessonSituations, I can import getSheet directly or use getLessonSituations but since it filters by lesson_id ... Wait, `getLessonSituations` signature: `export async function getLessonSituations(lessonId: string): Promise<LessonSituationRow[]>`
        // Let's fetch the list iteratively (slow) OR create a new function `getAllLessonSituations`. Since it's server-side with cache, it's okay for now or we can just fetch the raw sheet.
        // It's safer to just fetch `LessonSituations` manually here to avoid modifying `sheets.ts` too much, or I can update `sheets.ts`. Oh wait, I just need them by lessonId. So I can do Promise.all() for each lesson.

        const allSitItems = await getAllSituationItems();
        const itemSitsMap = new Map<string, string[]>(); // situation_id -> item_ids[]
        allSitItems.forEach(si => {
            if (!itemSitsMap.has(si.situation_id)) itemSitsMap.set(si.situation_id, []);
            itemSitsMap.get(si.situation_id)!.push(si.item_id);
        });

        const lessonProgressData = await Promise.all(lessons.map(async (lesson) => {
            const situations = await getLessonSituations(lesson.lesson_id);
            const sitIds = situations.map(s => s.situation_id);

            let totalItems = 0;
            let doneItems = 0;
            let lastAttemptAt: Date | null = null;

            sitIds.forEach(sid => {
                const items = itemSitsMap.get(sid) || [];
                totalItems += items.length;

                items.forEach(itemId => {
                    const finalizedDate = lastFinalizedAtMap.get(itemId);
                    if (finalizedDate) {
                        doneItems++;
                        if (!lastAttemptAt || finalizedDate > lastAttemptAt) {
                            lastAttemptAt = finalizedDate;
                        }
                    } else {
                        // Check if pending or failed (just for lastAttemptAt?)
                        // "last_attempt_at (computed from Attempts)" - means literally any attempt date for this lesson's items.
                    }
                });
            });

            // Re-calculate last_attempt_at more broadly if needed.
            // Let's scan all playerAttempts for items in this lesson.
            const lessonItemIds = new Set<string>();
            sitIds.forEach(sid => {
                (itemSitsMap.get(sid) || []).forEach(id => lessonItemIds.add(id));
            });

            let latestActivityAt: string | null = null;
            let latestMs = 0;
            playerAttempts.forEach(a => {
                if (lessonItemIds.has(a.item_id)) {
                    const d = new Date(a.date_time || a.created_at || '').getTime();
                    if (!isNaN(d) && d > latestMs) {
                        latestMs = d;
                        latestActivityAt = a.date_time || a.created_at || null;
                    }
                }
            });

            return {
                lesson_id: lesson.lesson_id,
                lesson_no: lesson.lesson_no,
                lesson_title_ko: lesson.lesson_title_ko,
                lesson_type: lesson.lesson_type,
                lesson_date: lesson.lesson_date,
                created_at: lesson.created_at,
                progress: {
                    done_count: doneItems,
                    total_count: totalItems
                },
                last_attempt_at: latestActivityAt
            };
        }));

        return NextResponse.json({ success: true, lessons: lessonProgressData });

    } catch (error: any) {
        console.error('Error fetching review lessons:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
