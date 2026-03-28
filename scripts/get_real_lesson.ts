import { getLessons } from '../src/utils/sheets';

async function main() {
    const lessons = await getLessons();
    console.log("Found lessons:", lessons.length);
    if (lessons.length > 0) {
        console.log("Top 3 Lessons:");
        console.log(lessons.slice(0, 3).map(l => `${l.lesson_id} - ${l.lesson_title_ko}`));
    }
}

main().catch(console.error);
