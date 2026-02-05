import { NextRequest, NextResponse } from 'next/server';
import { getAttempts } from '@/utils/sheets';

export async function POST(req: NextRequest) {
    try {
        const { role, username, password } = await req.json();

        // 1. Teacher Login
        if (role === 'teacher') {
            const adminUser = process.env.TEACHER_USERNAME || 'admin';
            const adminPass = process.env.TEACHER_PASSWORD || 'football'; // fallback per prompt

            if (username === adminUser && password === adminPass) {
                return NextResponse.json({
                    success: true,
                    user: {
                        id: 'admin',
                        name: 'Teacher',
                        role: 'teacher'
                    }
                });
            } else {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }
        }

        // 2. Player Login
        if (role === 'player') {
            // Validate against Sheets
            // Logic: Check if player_id OR player_name exists in attempts
            // Note: username passed here is the input ID
            const attempts = await getAttempts();

            // Search for exact match locally (since sheet size is small for now)
            // If scale becomes issue, we might need a dedicated Users sheet, but per prompt: use Attempts.

            const matchedAttempt = attempts.find(a =>
                (a.player_id && a.player_id.toLowerCase() === username.toLowerCase()) ||
                (a.player_name && a.player_name.toLowerCase() === username.toLowerCase())
            );

            if (matchedAttempt) {
                // Determine ID and Name
                // If they logged in with Name, use ID from row if available.
                // Priority: ID > Name.
                // Wait, if multiple players share name 'Kim', this logic picks the first one. Prompt acknowledged this risk.

                return NextResponse.json({
                    success: true,
                    user: {
                        id: matchedAttempt.player_id || 'anon',
                        name: matchedAttempt.player_name || 'Anonymous',
                        role: 'player'
                    }
                });
            } else {
                // Allow "New User"? The prompt implies validation.
                // "validate by checking if there is ANY row"
                // If no row, maybe return error or allow sign up?
                // Let's return error "User not found" for now.
                return NextResponse.json({ error: 'Player record not found. Please Ask Teacher.' }, { status: 404 });
            }
        }

        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    } catch (e) {
        console.error('Login error', e);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
