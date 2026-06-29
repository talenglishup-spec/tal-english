import { NextRequest, NextResponse } from 'next/server';
import { getTeamByCode } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { team_code } = body;

        if (!team_code) {
            return NextResponse.json({ error: 'Team code required' }, { status: 400 });
        }

        const team = await getTeamByCode(team_code.trim().toUpperCase());

        if (!team) {
            return NextResponse.json({ valid: false, error: 'Invalid team code' }, { status: 404 });
        }

        return NextResponse.json({ valid: true, team_name: team.team_name, team_id: team.team_id });
    } catch (e) {
        console.error('Team validate error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
