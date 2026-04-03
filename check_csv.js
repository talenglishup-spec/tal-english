import fs from 'fs';
import path from 'path';

// Let's use fetch targeting localhost if the server is running, or we can just read the DB directly if we know where the CSVs are.
// I will check the CSV data. In previous context, we saw `lesson_atom_bank.csv`.
const p = "c:/Users/sangha.lee/Desktop/TAL/football-trainer/src/data/lesson_atom_bank.csv";

if (fs.existsSync(p)) {
    const data = fs.readFileSync(p, 'utf8');
    const lines = data.split('\n');
    console.log("Header:", lines[0]);
    // just sample a few lines
    for(let i=1; i<Math.min(5, lines.length); i++) {
        console.log("Line", i, ":", lines[i].substring(0, 100) + '...');
    }
} else {
    console.log("No CSV found at", p);
}
