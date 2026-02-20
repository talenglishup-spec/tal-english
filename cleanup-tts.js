require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function cleanUp() {
    console.log('Starting cleanup...');
    const url = process.env.SUPABASE_URL;
    // Use service role key if available, else fallback
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!url || !key) {
        console.error('Missing Supabase credentials.');
        return;
    }

    const sb = createClient(url, key);

    try {
        // List all files in the 'tts' folder
        const { data: files, error } = await sb.storage.from('tal-audio').list('tts', {
            limit: 1000,
            offset: 0,
        });

        if (error) {
            console.error('Error listing files:', error.message);
            return;
        }

        if (!files || files.length === 0) {
            console.log('No files found to delete.');
            return;
        }

        // Filter files (we only want to delete files, not the 'en' folder if it exists)
        const filesToDelete = files.filter(f => f.id && f.name.endsWith('.mp3')).map(f => `tts/${f.name}`);

        if (filesToDelete.length === 0) {
            console.log('No old mp3 files found to delete in the root tts folder.');
            return;
        }

        console.log(`Found ${filesToDelete.length} files to delete. Attempting deletion...`);

        const { data: delResult, error: delError } = await sb.storage.from('tal-audio').remove(filesToDelete);

        if (delError) {
            console.error('Error deleting files:', delError.message);
        } else {
            console.log('Successfully deleted accumulate files!', delResult.length);
        }
    } catch (err) {
        console.error('Caught error:', err.message);
    }
}

cleanUp();
