import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Usually anon key if RLS fails
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Fallback to KEY if missing

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase credentials missing.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client to bypass RLS logic (uses service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');
