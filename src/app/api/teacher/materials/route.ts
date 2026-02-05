import { NextRequest, NextResponse } from 'next/server';
import { getMaterials, addMaterial } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const materials = await getMaterials();
        return NextResponse.json({ materials });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, url, type, player_id } = body;

        if (!title || !url || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newMaterial = {
            id: uuidv4(),
            date_added: new Date().toISOString().split('T')[0],
            title,
            url,
            type,
            player_id: player_id || 'all'
        };

        await addMaterial(newMaterial);

        return NextResponse.json({ success: true, material: newMaterial });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to add material' }, { status: 500 });
    }
}
