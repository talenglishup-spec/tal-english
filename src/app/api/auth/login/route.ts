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
            // HARDCODED DEMO USERS (Per User Request)
            const demoUsers: Record<string, string> = {
                'id001': 'id001',
                'id002': 'id002'
            };

            // Check hardcoded first
            if (demoUsers[username]) {
                if (password === demoUsers[username]) {
                    return NextResponse.json({
                        success: true,
                        user: {
                            id: username,
                            name: username === 'id001' ? 'Sonny' : 'Minjae', // Example names
                            role: 'player'
                        }
                    });
                } else {
                    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
                }
            }

            // Fallback: Validate against Sheets (Older Logic, Password Ignored or Optional)
            // If user enters ID not in demo list, we check sheet? 
            // User request implies specific users. Let's keep sheet check for backward compat if needed, 
            // but strict on Demo users for now if they are the target.
            // *However*, sheet lookup has no password field.
            // So if it's not a demo user, we fail if we enforce password?
            // Let's make password required only for hardcoded.

            const attempts = await getAttempts();
            const matchedAttempt = attempts.find(a =>
                (a.player_id && a.player_id.toLowerCase() === username.toLowerCase())
            );

            if (matchedAttempt) {
                // Determine if we strictly require password. 
                // Since prompt gave specific users with passwords, other existing users might not have them.
                // We allow existing users without password check for now (MVP).
                return NextResponse.json({
                    success: true,
                    user: {
                        id: matchedAttempt.player_id || 'anon',
                        name: matchedAttempt.player_name || 'Anonymous',
                        role: 'player'
                    }
                });
            } else {
                return NextResponse.json({ error: 'Player record not found.' }, { status: 404 });
            }
        }

        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    } catch (e) {
        console.error('Login error', e);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
