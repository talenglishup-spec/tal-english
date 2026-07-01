import { NextRequest, NextResponse } from 'next/server';
import { getMaterials, addMaterial } from '@/utils/sheets';
import { v4 as uuidv4 } from 'uuid';
import { requireStaffAuth } from '@/utils/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = await requireStaffAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const materials = await getMaterials();
        return NextResponse.json({ materials });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireStaffAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await req.json();
        const { title, url, type, note } = body;

        if (!title || !url || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newMaterial = {
            material_id: uuidv4(),
            date_added: new Date().toISOString().split('T')[0],
            title,
            url,
            type,
            note: note || '',
            active: true
        };

        await addMaterial(newMaterial);

        return NextResponse.json({ success: true, material: newMaterial });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to add material' }, { status: 500 });
    }
}
