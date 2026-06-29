import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/utils/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const supabase = getSupabase();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', user: data.user }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
