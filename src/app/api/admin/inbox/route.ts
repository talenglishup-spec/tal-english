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

export async function GET() {
  const auth = await requireStaffAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    
    const inboxItems = rows
      .filter(row => row.get('active') === 'FALSE')
      .map(row => ({
        clip_id: row.get('clip_id'),
        title_en: row.get('title_en'),
        player_name: row.get('player_name'),
        youtube_url: row.get('youtube_url'),
        video_id: row.get('youtube_url')?.split('youtu.be/')[1] || row.get('youtube_url')?.split('v=')[1],
        start_sec: row.get('start_sec'),
        end_sec: row.get('end_sec'),
        pause_at: row.get('pause_at'),
        target_phrase: row.get('target_phrase'),
        translation: row.get('translation'),
        difficulty: row.get('difficulty'),
        type: row.get('type'),
        subtype: row.get('subtype'),
        notes: row.get('notes'),
      }));

    return NextResponse.json({ items: inboxItems });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaffAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { action, clip_id, updates } = await request.json();
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    
    const row = rows.find(r => r.get('clip_id') === clip_id);
    if (!row) return NextResponse.json({ error: 'Clip not found' }, { status: 404 });

    if (action === 'delete') {
      await row.delete();
      clearSheetCache();
      return NextResponse.json({ success: true, message: 'Deleted' });
    } 
    else if (action === 'update') {
      if (updates.target_phrase) row.set('target_phrase', updates.target_phrase);
      if (updates.translation) row.set('translation', updates.translation);
      if (updates.pause_at) row.set('pause_at', updates.pause_at);
      if (updates.difficulty) row.set('difficulty', updates.difficulty);
      if (updates.subtype) row.set('subtype', updates.subtype);
      
      await row.save();
      clearSheetCache();
      return NextResponse.json({ success: true, message: 'Updated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
