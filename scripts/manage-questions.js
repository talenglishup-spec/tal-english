const fs = require('fs');
const path = require('path');

const MASTER_PATH = path.join(__dirname, '../data/questions/question_master.csv');
const ALIAS_PATH = path.join(__dirname, '../data/questions/question_aliases.csv');
const CANDIDATE_PATH = path.join(__dirname, '../data/questions/question_new_candidates.csv');

function loadCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = (parts[i] || '').replace(/^"|"$/g, '');
        });
        return obj;
    });
}

function saveCSV(filePath, headers, data) {
    const headerLine = headers.map(h => `"${h}"`).join(',');
    const rows = data.map(item => {
        return headers.map(h => {
            const val = item[h] || '';
            return `"${val}"`;
        }).join(',');
    });
    fs.writeFileSync(filePath, [headerLine, ...rows].join('\n') + '\n');
}

const command = process.argv[2];

if (command === 'list' || !command) {
    console.log('\n--- Question Candidates for Review ---');
    const candidates = loadCSV(CANDIDATE_PATH);
    if (candidates.length === 0) {
        console.log('No candidates found.');
    } else {
        candidates.forEach((c, i) => {
            console.log(`[${i}] Text: "${c.raw_text}"`);
            console.log(`    Hits: ${c.hit_count} | Suggested ID: ${c.suggested_id || 'None'}`);
        });
    }

    console.log('\n--- Master Questions (Reference) ---');
    const masters = loadCSV(MASTER_PATH);
    masters.forEach(m => {
        console.log(`${m.id}: ${m.question_en} (${m.notes})`);
    });

    console.log('\n--- Existing Aliases (Reference) ---');
    const aliases = loadCSV(ALIAS_PATH);
    aliases.slice(-5).forEach(a => {
        console.log(`${a.alias_id} -> ${a.master_id}: ${a.alias_text}`);
    });
    
    console.log('\nUsage: node scripts/manage-questions.js approve <index> <master_id> <optional_alias_id>');
}

if (command === 'approve') {
    const index = parseInt(process.argv[3]);
    const masterId = process.argv[4];
    let aliasId = process.argv[5];

    if (isNaN(index) || !masterId) {
        console.error('Usage: node scripts/manage-questions.js approve <index> <master_id> <optional_alias_id>');
        process.exit(1);
    }

    const candidates = loadCSV(CANDIDATE_PATH);
    const masters = loadCSV(MASTER_PATH);
    const aliases = loadCSV(ALIAS_PATH);
    
    if (!candidates[index]) {
        console.error(`Invalid index: ${index}`);
        process.exit(1);
    }

    const masterExists = masters.some(m => m.id === masterId);
    if (!masterExists) {
        console.error(`Invalid Master ID: ${masterId}`);
        process.exit(1);
    }

    const candidate = candidates[index];
    const aliasText = candidate.raw_text;

    // Auto-generate alias ID if not provided
    if (!aliasId) {
        const existingForMaster = aliases.filter(a => a.master_id === masterId);
        // Find highest number in Q01-N pattern
        let maxNum = 0;
        existingForMaster.forEach(a => {
            const match = a.alias_id.match(/-(\d+)$/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        aliasId = `${masterId}-${maxNum + 1}`;
    }

    // 1. Add to Alias
    aliases.push({ alias_id: aliasId, alias_text: aliasText, master_id: masterId });
    saveCSV(ALIAS_PATH, ['alias_id', 'alias_text', 'master_id'], aliases);

    // 2. Remove from Candidate
    candidates.splice(index, 1);
    saveCSV(CANDIDATE_PATH, ['raw_text', 'hit_count', 'last_seen', 'suggested_id'], candidates);

    console.log(`\n✅ Approved! "${aliasText}" is now Alias [${aliasId}] for Master [${masterId}].`);
}
