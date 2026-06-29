import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

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

async function run() {
    console.log("Loading Google Sheet...");
    await doc.loadInfo();

    // 1. Add subscriptions sheet if it doesn't exist
    const subSheetTitle = 'subscriptions';
    let subSheet = doc.sheetsByTitle[subSheetTitle];
    if (!subSheet) {
        console.log(`Creating ${subSheetTitle} sheet...`);
        subSheet = await doc.addSheet({
            title: subSheetTitle,
            headerValues: [
                'order_id', 'player_id', 'plan', 'period', 'amount', 'status', 'payment_key', 'paid_at', 'created_at'
            ]
        });
        console.log(`${subSheetTitle} sheet created.`);
    } else {
        console.log(`${subSheetTitle} sheet already exists.`);
    }

    // 2. Update Players sheet
    const playersSheetTitle = 'Players';
    const playersSheet = doc.sheetsByTitle[playersSheetTitle];
    if (!playersSheet) {
        throw new Error(`Sheet ${playersSheetTitle} not found!`);
    }

    console.log(`Updating ${playersSheetTitle} sheet...`);
    await playersSheet.loadHeaderRow();
    const headers = [...playersSheet.headerValues];

    const newColumns = [
        'subscription_status',
        'subscription_plan',
        'subscription_until',
        'team_id',
        'track',
        'onboarding_complete'
    ];

    let headersModified = false;
    for (const col of newColumns) {
        if (!headers.includes(col)) {
            headers.push(col);
            headersModified = true;
        }
    }

    if (headersModified) {
        console.log("Adding new headers to Players sheet...");
        await playersSheet.setHeaderRow(headers);
    } else {
        console.log("Headers already up to date.");
    }

    console.log("Updating existing player rows...");
    const rows = await playersSheet.getRows();
    let rowsUpdated = 0;
    for (const row of rows) {
        let changed = false;
        
        // subscription_status 기본값 "free"
        if (!row.get('subscription_status')) {
            row.set('subscription_status', 'free');
            changed = true;
        }
        
        if (changed) {
            await row.save();
            rowsUpdated++;
        }
    }

    console.log(`Updated ${rowsUpdated} existing player rows with default values.`);
    console.log("Done!");
}

run().catch(console.error);
