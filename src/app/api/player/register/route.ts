import { NextRequest, NextResponse } from 'next/server';
import { getTeamByCode, insertPlayer } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, position, team_code, level } = body;

        if (!name || !position || !level) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let team_id = 'SOLO';
        let team_name = 'SOLO';
        if (team_code && team_code.trim() !== '') {
            const team = await getTeamByCode(team_code.trim().toUpperCase());
            if (!team) {
                return NextResponse.json({ error: 'Invalid team code' }, { status: 400 });
            }
            team_id = team.team_id;
            team_name = team.team_name;
        }

        const isSolo = team_id === 'SOLO';
        const player_id = isSolo 
          ? `solo_${position.toLowerCase()}_${Date.now()}` 
          : `${team_id}_${position.toLowerCase()}_${Date.now()}`;
          
        const password = player_id;

        await insertPlayer({
            player_id,
            player_name: name.trim(),
            password,
            position: position.trim(),
            team_id: team_id,
            level,
            track: 'A',
        });

        // n8n webhook (fire-and-forget)
        const webhookUrl = process.env.N8N_WEBHOOK_ONBOARDING;
        if (webhookUrl) {
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id,
                    name: name.trim(),
                    position,
                    team_code: isSolo ? 'SOLO' : team_code,
                    team_name: team_name,
                    level,
                }),
            }).catch(() => undefined);
        }

        return NextResponse.json({ success: true, player_id, password });
    } catch (e) {
        console.error('Player register error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
