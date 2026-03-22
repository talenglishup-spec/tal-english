import { createClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

const customFetchOptions = {
    global: {
        fetch: fetch
    }
};

export const getSupabase = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_KEY || '';
    
    console.log(`[Supabase Init] URL present: ${!!supabaseUrl}, Key present: ${!!supabaseKey}`);
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials missing in environment variables (SUPABASE_URL/SUPABASE_KEY).");
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
