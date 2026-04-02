require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Custom CSV Parser to handle quotes and commas (borrowed from project pattern)
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = [];
    let current = '';
    let inQuotes = false;

    // Correctly handle commas inside quotes
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j+1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Double quote inside quotes "" -> "
          current += '"';
          j++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj = {};
    headers.forEach((h, index) => {
      let val = values[index] || '';
      // Clean up surrounding quotes
      val = val.replace(/^"|"$/g, '').trim();
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}

async function syncDay39() {
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

    const auth = new JWT({
        email: SERVICE_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    
    try {
        await doc.loadInfo();
        const intakeSheet = doc.sheetsByTitle['ContentIntake'];
        if (!intakeSheet) {
            console.error("'ContentIntake' sheet not found.");
            process.exit(1);
        }

        const csvPath = path.join(__dirname, '../data/day39_connectors.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const records = parseCSV(csvContent);

        console.log(`Read ${records.length} items from CSV.`);

        // Situation Mapping
        const situationMap = {
            'onpitch': { order: 1, title: '경기장 내 연결어 (On-pitch)' },
            'interview': { order: 2, title: '인터뷰 연결어 (Interview)' },
            'life': { order: 3, title: '일상 생활 연결어 (Daily Life)' }
        };

        const rowsToAdd = records.map((record, index) => {
            const sit = situationMap[record.category.toLowerCase()] || { order: 4, title: '기타 연습' };
            
            return {
                active: 'TRUE',
                player_id: 'P001', // 설영우 선수 대상
                lesson_no: '39',
                lesson_title_ko: 'Lesson 39: 문장 연결하기 (Connectors)',
                situation_order: sit.order.toString(),
                situation_title_ko: sit.title,
                item_order: (index + 1).toString(),
                category: record.category.toLowerCase(),
                subtype: 'practice',
                practice_type: 'A',
                prompt_kr: record.prompt_kr,
                target_en: record.target_en,
                cloze_target: '', 
                expected_phrases: record.allowed_variations,
                max_latency_ms: record.category.toLowerCase() === 'onpitch' ? '1500' : '2000',
                pattern_type: record.key_word,
                hint_guide: record.focus_point,
                notes: record.coach_note || 'Imported from day39_connectors.csv',
                item_id_override: record.item_id
            };
        });

        console.log(`Adding ${rowsToAdd.length} rows to ContentIntake...`);
        
        // Add rows in batches to avoid timeout/quota issues
        const batchSize = 10;
        for (let i = 0; i < rowsToAdd.length; i += batchSize) {
            const batch = rowsToAdd.slice(i, i + batchSize);
            await intakeSheet.addRows(batch);
            console.log(`   Processed ${i + batch.length}/${rowsToAdd.length}`);
            if (i + batchSize < rowsToAdd.length) {
                await new Promise(r => setTimeout(r, 1500)); // Respect quota
            }
        }

        console.log("✅ Successfully uploaded all items to Google Sheets.");

    } catch (e) {
        console.error("Error syncing Day 39:", e);
    }
}

syncDay39();
