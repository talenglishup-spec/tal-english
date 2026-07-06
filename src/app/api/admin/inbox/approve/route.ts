import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { clearSheetCache } from '@/lib/sheets';
import { requireStaffAuth } from '@/utils/supabaseServer';

async function getSheet() {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
  await doc.loadInfo();
  return doc.sheetsByTitle['Clips'];
}

export async function POST(request: Request) {
  const auth = await requireStaffAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { clip_ids } = await request.json();
    if (!clip_ids || !Array.isArray(clip_ids) || clip_ids.length === 0) {
      return NextResponse.json({ error: 'No clip_ids provided' }, { status: 400 });
    }

    const sheet = await getSheet();
    await sheet.loadCells(); // Load all cells
    
    // Find rows and update the 'active' cell
    const rows = await sheet.getRows();
    let updatedCount = 0;
    
    // Header for 'active' is column index 0 (A)
    // To be safe, find header index
    const headers = sheet.headerValues;
    const activeColIndex = headers.indexOf('active');
    const clipIdColIndex = headers.indexOf('clip_id');
    
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = rows[i].rowNumber - 1; // 0-indexed for cells
      const cellClipId = sheet.getCell(rowIndex, clipIdColIndex).value;
      
      if (clip_ids.includes(cellClipId)) {
        const activeCell = sheet.getCell(rowIndex, activeColIndex);
        activeCell.value = 'TRUE';
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await sheet.saveUpdatedCells();
      clearSheetCache();
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
