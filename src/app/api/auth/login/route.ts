import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/utils/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { playerId, password } = body;

        if (!playerId || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const player = await getPlayer(playerId);

        if (!player) {
            return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
        }

        // Test Phase: Plain text password check
        if (player.password !== password) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        // Determine Role
        const isAdmin = player.player_id === 'ADMIN001';
        const role = isAdmin ? 'teacher' : 'player';

        return NextResponse.json({
            success: true,
            user: {
                id: player.player_id,
                name: player.player_name,
                role: role,
                isAdmin: isAdmin
            }
        });

    } catch (e) {
        console.error('Login error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
