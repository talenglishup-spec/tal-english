require('dotenv').config({ path: '.env.local' });
const { getItems } = require('./src/utils/sheets');

async function debug() {
    console.log("Checking environment...");
    console.log("SHEET_ID:", process.env.GOOGLE_SHEET_ID);
    
    try {
        const items = await getItems();
        console.log(`Fetched ${items.length} items.`);
        
        const sampled = items.filter(a => a.matched_question_text).length;
        console.log(`Items with matched_question_text: ${sampled}`);
        
        if (items.length > 0) {
            console.log("\nFirst 3 items samples:");
            items.slice(0, 3).forEach(item => {
                console.log(`- ID: ${item.id}`);
                console.log(`  Question: ${item.matched_question_text}`);
                console.log(`  Manual Q: ${item.question_text}`);
            });
        }
    } catch (e) {
        console.error("Debug Error:", e);
    }
}

debug();
