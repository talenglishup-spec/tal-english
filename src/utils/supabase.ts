import { createClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Usually anon key if RLS fails
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Please check your environment variables.');
}

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase credentials missing.");
}

const customFetchOptions = {
    global: {
        fetch: fetch
    }
};

export const supabase = createClient(supabaseUrl, supabaseKey, customFetchOptions);

// Admin client to bypass RLS logic (uses service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', customFetchOptions);
