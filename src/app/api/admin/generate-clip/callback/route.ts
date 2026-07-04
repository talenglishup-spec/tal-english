import { NextRequest, NextResponse } from 'next/server';
import { addClipItem, type ClipItem } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    // 1. n8n 발송 토큰 보안 검증
    const authHeader = req.headers.get('authorization');
    const N8N_CALLBACK_TOKEN = process.env.N8N_CALLBACK_TOKEN || 'secure-callback-token-123';

    if (authHeader !== 'Bearer ' + N8N_CALLBACK_TOKEN) {
      console.warn('[Security Warn] Unauthorized callback attempt. AuthHeader:', authHeader);
      return NextResponse.json({ error: 'Unauthorized callback token' }, { status: 401 });
    }

    const {
      clip_id,
      title_ko,
      title_en,
      youtube_url,
      player_name,
      position_tag,
      type,
      subtype,
      start_sec,
      end_sec,
      speak_mode,
      pause_at,
      target_phrase,
      nuance_desc,
      similar_expressions,
      audio_explanation_url,
      translation,
      tags,
      notes
    } = await req.json();

    if (!clip_id || !youtube_url || !target_phrase) {
      return NextResponse.json({ error: 'Missing core metadata fields' }, { status: 400 });
    }

    const clipData: Omit<ClipItem, 'speak_mode'> & { speak_mode: boolean } = {
      clip_id,
      title_ko: title_ko || 'AI Drill - ' + target_phrase,
      title_en: title_en || 'AI Drill - ' + target_phrase,
      youtube_url,
      player_name: player_name || 'SONNY',
      position_tag: position_tag || 'ALL',
      type: type || 'interview',
      subtype: subtype || 'post_match',
      start_sec: parseFloat(start_sec || '0'),
      end_sec: parseFloat(end_sec || '0'),
      speak_mode: speak_mode === true || speak_mode === 'TRUE' || speak_mode === 'true',
      pause_at: parseFloat(pause_at || '0'),
      target_phrase,
      nuance_desc: nuance_desc || '',
      similar_expressions: similar_expressions || '',
      audio_explanation_url: audio_explanation_url || '',
      translation: translation || '',
      tags: tags || 'AI_Callback',
      notes: notes || 'Callback processed successfully'
    };

    console.log('[Phase 6 Callback] Received completed metadata from n8n. Inserting row...');

    // Google Sheets Clips CMS 탭에 정적 데이터 밀어넣기
    const inserted = await addClipItem(clipData);

    if (inserted) {
      return NextResponse.json({
        success: true,
        message: 'Google Sheets Clips CMS updated successfully via n8n callback.',
        clip_id
      }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to insert row to Google Sheet' }, { status: 500 });
    }

  } catch (err: any) {
    console.error('[/api/admin/generate-clip/callback] Callback Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
