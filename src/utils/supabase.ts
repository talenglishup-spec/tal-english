import { createClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

const customFetchOptions = {
    global: {
        fetch: fetch
    }
};

export const getSupabase = () => {
    // NEXT_PUBLIC_ prefix required for client-side (browser) access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
    }
    return createClient(supabaseUrl, supabaseKey, customFetchOptions);
};

export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    console.log(`[Supabase Admin Init] URL present: ${!!supabaseUrl}, AdminKey present: ${!!supabaseServiceKey}`);

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase Admin credentials missing (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).");
    }
    return createClient(supabaseUrl, supabaseServiceKey, customFetchOptions);
};
