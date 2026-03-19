const fs = require('fs');
const path = require('path');

async function testPost() {
    const formData = new FormData();
    // Create a dummy blob for the file
    const blob = new Blob(["dummy audio content"], { type: "audio/webm" });
    formData.append('file', blob, 'recording.webm');
    formData.append('item_id', 'test_item_123');
    formData.append('target_en', 'Hello World');
    formData.append('session_id', 'test_session');
    formData.append('session_mode', 'practice');
    formData.append('challenge_type', 'FOOTBALL_KO_TO_EN');
    
    try {
        const res = await fetch('http://localhost:3000/api/process-attempt', {
            method: 'POST',
            body: formData,
        });
        const text = await res.text();
        console.log("STATUS:", res.status);
        console.log("BODY:", text);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
testPost();
