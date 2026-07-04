import { NextRequest, NextResponse } from 'next/server';
import { addClipItem, extractYouTubeId, type ClipItem } from '@/lib/sheets';
import { createClient } from '@/utils/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { youtube_url, target_phrase } = await req.json();

    if (!youtube_url) {
      return NextResponse.json({ error: 'Missing youtube_url' }, { status: 400 });
    }

    // 1. 관리자 권한 세션 체크 (이메일 비교 방식 가드 적용)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized admin session' }, { status: 401 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@talenglish.com';
    if (user.email !== adminEmail) {
      console.warn('[Security Warn] Non-admin email attempted generate-clip API access:', user.email);
      return NextResponse.json({ error: 'Forbidden: Admin privilege required' }, { status: 403 });
    }

    // 2. 비디오 ID 추출
    const videoId = extractYouTubeId(youtube_url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
    }

    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    const N8N_CALLBACK_TOKEN = process.env.N8N_CALLBACK_TOKEN || 'secure-callback-token-123';

    // 3. n8n 비동기 파이프라인 트리거 (N8N_WEBHOOK_URL이 있으면 즉시 202 Accepted 반환)
    if (N8N_WEBHOOK_URL) {
      console.log('[Phase 6 AI Pipeline] N8N Webhook detected. Launching asynchronous task...');
      
      const origin = req.nextUrl.origin;
      const callbackUrl = origin + '/api/admin/generate-clip/callback';

      // 비블로킹(Non-blocking) fetch 호출로 n8n 트리거 후 즉시 탈출
      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + N8N_CALLBACK_TOKEN
        },
        body: JSON.stringify({
          youtube_url,
          target_phrase,
          user_id: user.id,
          callback_url: callbackUrl
        })
      }).catch(err => {
        console.error('[Phase 6 n8n Trigger failed async]:', err);
      });

      // Vercel 타임아웃 방지를 위해 즉시 202 리턴 (CP-3 충족)
      return NextResponse.json({
        success: true,
        message: 'Asynchronous AI clip generation task accepted. n8n workflow started.',
        status: 'Accepted'
      }, { status: 202 });

    } else {
      // Mock Fallback: 환경변수가 없을 때 로컬 테스트용 모의 동기 파이프라인
      console.log('⚠️ [Phase 6 AI Pipeline Mock] N8N Webhook 미설정으로 가상 동기 삽입 플로우를 가동합니다.');
      
      const mockPlayers = ['SONNY', 'HAALAND', 'PEP'];
      const randomPlayer = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
      
      const generatedClip: Omit<ClipItem, 'speak_mode'> & { speak_mode: boolean } = {
        clip_id: 'ai-clip-' + Math.floor(Math.random() * 9000 + 1000),
        title_ko: randomPlayer + ' AI 추출 전술 훈련 (' + (target_phrase || '주변 확보') + ')',
        title_en: randomPlayer + ' Drill - ' + (target_phrase || 'Look around'),
        youtube_url,
        player_name: randomPlayer,
        position_tag: randomPlayer === 'PEP' ? 'ALL' : 'FW',
        type: randomPlayer === 'PEP' ? 'interview' : 'training',
        subtype: randomPlayer === 'PEP' ? 'press_conference' : 'tactical',
        start_sec: 10.0,
        end_sec: 16.0,
        speak_mode: true,
        pause_at: 14.5,
        target_phrase: target_phrase || 'We need to keep the shape',
        nuance_desc: 'AI 분석 결과, 감독 또는 필드 리더가 전술적 경기 대형을 유지하며 안정된 공수 밸런스를 가져가도록 경기 흐름 속에서 다급히 전술적 피드백을 전달하는 표현입니다.',
        similar_expressions: 'Hold the line, Stay compact, Maintain organization',
        audio_explanation_url: 'https://api.elevenlabs.io/v1/history/mock-synthetic-voice.mp3',
        translation: '',
        tags: 'mock_ai, ' + randomPlayer.toLowerCase(),
        notes: 'Mock AI Engine Auto-generated row'
      };

      const inserted = await addClipItem(generatedClip);

      if (inserted) {
        return NextResponse.json({
          success: true,
          message: 'AI content generated and inserted to Google Sheet Clips CMS successfully (Mock Mode).',
          item: generatedClip
        }, { status: 200 });
      } else {
        return NextResponse.json({ error: 'Failed to insert row to Google Sheet' }, { status: 500 });
      }
    }

  } catch (err: any) {
    console.error('[/api/admin/generate-clip] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
