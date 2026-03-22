const { getItems } = require('./src/utils/sheets');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const items = await getItems();
    if (items.length > 0) {
        console.log("First item sample:", items[0]);
    } else {
        console.log("No items found");
    }
}
check();
