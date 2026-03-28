import { getSheet, getLessons } from '../src/utils/sheets';

async function updateLessonId() {
    console.log("Fetching Lessons to find a valid ID...");
    const lessons = await getLessons();
    if (lessons.length === 0) {
        console.error("No lessons found!");
        return;
    }
    const realLessonId = lessons[0].lesson_id;
    console.log(`Will use real lesson_id: ${realLessonId}`);

    console.log("Fetching Expressions sheet...");
    const sheet = await getSheet('Expressions');
    if (!sheet) {
        console.error("Expressions sheet not found!");
        return;
    }
    const rows = await sheet.getRows();
    let updatedCount = 0;

    for (const row of rows) {
        if (row.get('lesson_id') === '2026-03-26') {
            row.set('lesson_id', realLessonId);
            await row.save();
            updatedCount++;
        }
    }

    console.log(`Updated ${updatedCount} rows to use lesson_id: ${realLessonId}`);
}

updateLessonId().catch(console.error);
