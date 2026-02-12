
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    // Dynamic import to ensure env vars are loaded
    const { getLessons, getLessonItems, getItems } = await import('../src/utils/sheets');

    const playerId = 'P001';

    console.log(`Debugging for Player: ${playerId}`);

    // 1. Check Lessons
    console.log('--- Lessons ---');
    const lessons = await getLessons(playerId);
    console.log(`Found ${lessons.length} lessons.`);
    lessons.forEach(l => console.log(`- ${l.lesson_id} (Active: ${l.active}, Date: ${l.lesson_date})`));

    if (lessons.length === 0) {
        console.log('-> No active lessons found. This is why nothing shows.');
        return;
    }

    const lessonIds = new Set(lessons.map(l => l.lesson_id));
    console.log(`Found Active Lesson IDs for P001: ${Array.from(lessonIds).join(', ')}`);


    // 2. Check Lesson Items
    console.log('\n--- Lesson Items ---');
    const allLessonItems = await getLessonItems();
    console.log(`Total LessonItems rows: ${allLessonItems.length}`);

    const assigned = allLessonItems.filter(li => lessonIds.has(li.lesson_id));
    console.log(`Items assigned to ${playerId}'s lessons: ${assigned.length}`);
    assigned.forEach(li => console.log(`- Lesson ${li.lesson_id} -> Item ${li.item_id} (Active: ${li.active})`));

    if (assigned.length === 0) {
        console.log('-> Lessons exist but no items assigned to them.');
        return;
    }

    // 3. Check Items
    console.log('\n--- Items ---');
    const allItems = await getItems();
    const itemMap = new Map();
    allItems.forEach(i => itemMap.set(i.id, i));

    let visibleCount = 0;
    assigned.forEach(li => {
        const item = itemMap.get(li.item_id);
        if (item) {
            console.log(`- Item ${li.item_id}: Found (Category: ${item.category})`);
            visibleCount++;
        } else {
            console.log(`- Item ${li.item_id}: NOT FOUND or INACTIVE in Items sheet`);
        }
    });

    console.log(`\n-> Total visible items: ${visibleCount}`);
}

debug().catch(console.error);
