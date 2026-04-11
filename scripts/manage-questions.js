import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidatesPath = path.join(__dirname, '../data/questions/question_new_candidates.csv');
const aliasesPath = path.join(__dirname, '../data/questions/question_aliases.csv');

// Simple CSV parser that handles basic quotes
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Very basic parsing assuming no newlines inside quotes for simplicity
    const parseLine = (line) => {
        const matches = line.match(/(?:"[^"]*"|[^,]+|)(?=\s*,|\s*$)/g) || [];
        return matches.map(m => m.replace(/^"|"$/g, '').trim());
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
    return { headers, rows };
}

function writeCsv(filePath, headers, rows) {
    const quote = (str) => {
        if (str === null || str === undefined) return '""';
        const strVal = String(str);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
    };
    
    // Some logic requires exact header matches or without quotes.
    // For aliases, we noticed header is "alias_id,alias_text,master_id," with a trailing comma.
    // We will just do a standard mapping.
    let content = headers.join(',') + '\n';
    rows.forEach(row => {
        content += row.map(quote).join(',') + '\n';
    });
    fs.writeFileSync(filePath, content, 'utf-8');
}

function writeAliasesCsv(filePath, lines) {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
    console.log(`
Usage:
  node manage-questions.js list
  node manage-questions.js approve <index> <master_id>
  node manage-questions.js reject <index>
`);
    process.exit(0);
}

if (!fs.existsSync(candidatesPath)) {
    console.error('Candidates file not found:', candidatesPath);
    process.exit(1);
}

const content = fs.readFileSync(candidatesPath, 'utf-8');
const { headers, rows } = parseCSV(content);

if (command === 'list') {
    if (rows.length === 0) {
        console.log('No new candidate questions.');
        process.exit(0);
    }
    console.log('--- Pending Candidate Questions ---');
    rows.forEach((row, index) => {
        // "raw_text","hit_count","last_seen","suggested_id"
        // Adjust indexing based on CSV structure
        const rawText = row[0];
        const count = row[1];
        console.log(`[${index}] "${rawText}" (Hits: ${count})`);
    });
}
else if (command === 'approve' || command === 'reject') {
    const index = parseInt(args[1], 10);
    if (isNaN(index) || index < 0 || index >= rows.length) {
        console.error('Invalid index. Run "list" to see valid indices.');
        process.exit(1);
    }

    const candidate = rows[index];
    const rawText = candidate[0];

    if (command === 'approve') {
        const masterId = args[2];
        if (!masterId) {
            console.error('master_id is required for approval. Example: node manage-questions.js approve 0 Q01');
            process.exit(1);
        }

        // Generate simple alias_id
        const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const aliasId = `${masterId}-N${shortId}`;

        // Append to alias CSV
        // format: alias_id,alias_text,master_id,
        const aliasContent = fs.readFileSync(aliasesPath, 'utf-8').trim().split('\n');
        
        let safeAliasText = rawText;
        if (safeAliasText.includes(',')) {
            safeAliasText = `"${safeAliasText.replace(/"/g, '""')}"`;
        }

        aliasContent.push(`${aliasId},${safeAliasText},${masterId},`);
        writeAliasesCsv(aliasesPath, aliasContent);

        console.log(`✅ Approved: "${rawText}" is now mapped to ${masterId} as ${aliasId}.`);
    } else {
        console.log(`❌ Rejected: "${rawText}" has been discarded.`);
    }

    // Remove from candidates and save
    rows.splice(index, 1);
    writeCsv(candidatesPath, headers, rows);
    console.log(`Candidates list updated. (${rows.length} remaining)`);
} else {
    console.log('Unknown command:', command);
}
