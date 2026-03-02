require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch'); // Needs to be fetch-compatible or run in Node 18+

async function runSync() {
    console.log("Triggering Sync API locally...");
    try {
        // We will call the API by importing the route directly instead of http if the server isn't running?
        // No, we can just run the sync logic by creating a small node script or if the dev server is running, hit localhost:3000.
        // Wait, node 18 has native fetch. Let's try localhost:3000 first.
        const res = await fetch('http://localhost:3000/api/admin/sync-content', {
            method: 'POST',
            headers: {
                'x-admin-token': process.env.ADMIN_TOKEN || 'local_dev'
            }
        });
        const text = await res.text();
        console.log(res.status, text);
    } catch (e) {
        console.error("Failed to hit API (is server running?):", e.message);
    }
}

runSync();
