async function testSync() {
    try {
        console.log("Triggering sync via API...");
        const res = await fetch('http://localhost:3000/api/admin/sync-content', {
            method: 'POST'
        });
        const data = await res.json();
        console.log("STATUS:", res.status);
        console.log("RESPONSE:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}
testSync();
