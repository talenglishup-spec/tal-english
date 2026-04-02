import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config({ path: '.env.local' });

// Credentials from .env.local
const SHEET_ID      = process.env.GOOGLE_SHEET_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY   = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/^"|"$/g, '');

// CSV Parser that handles double quotes correctly
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = [];
    let current = '';
    let inQuotes = false;

    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    // Map to object
    const obj = {};
    headers.forEach((h, index) => {
      obj[h.trim()] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
    });
    result.push(obj);
  }
  return result;
}

async function main() {
  console.log('🚀 Finalizing: Uploading Day 1~39 Football English Curriculum to Google Sheets');
  
  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.error('❌ Missing Google credentials in .env.local');
    process.exit(1);
  }

  // 1. Read CSV
  const csvPath = 'data/expressions_all.csv';
  console.log(`Reading ${csvPath}...`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const items = parseCSV(csvContent);
  console.log(`Parsed ${items.length} items.`);

  // 2. Connect
  const auth = new JWT({
    email:  SERVICE_EMAIL,
    key:    PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`✅ Connected to: "${doc.title}"`);

  // 3. Get Expressions Sheet
  const sheet = doc.sheetsByTitle['Expressions'];
  if (!sheet) {
    console.error('❌ "Expressions" sheet not found! Run setup-expression-sheets.mjs first.');
    process.exit(1);
  }

  // 4. Clear existing rows
  console.log('Clearing existing rows in "Expressions" sheet...');
  await sheet.clearRows();
  console.log('✅ Sheet cleared.');

  // 5. Upload new rows
  console.log(`Uploading ${items.length} expressions in chunks...`);
  // Break into chunks to avoid API limits if necessary, though 117 is small
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await sheet.addRows(chunk);
    console.log(`   ... Uploaded ${i + chunk.length} / ${items.length}`);
  }

  console.log('\n✨ SUCCESS! Curriculum integration complete.');
  console.log(`📊 Stats:`);
  console.log(`   - On-Pitch: ${items.filter(i => i.category === 'on-pitch').length}`);
  console.log(`   - Interview: ${items.filter(i => i.category === 'interview').length}`);
  console.log(`   - Life: ${items.filter(i => i.category === 'life').length}`);
  console.log(`   - New Codes: PC-01~06 and RA-01 applied.`);
  
  console.log('\nYou can now review the data at:');
  console.log(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
