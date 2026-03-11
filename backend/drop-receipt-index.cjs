const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    // Attempt to drop the unique receiptId index
    await db.collection('financelogs').dropIndex('receiptId_1');
    console.log('✅ Successfully dropped unique index on receiptId');
  } catch(e) {
    if (e.codeName === 'IndexNotFound') {
        console.log('ℹ️ Index already dropped or not found');
    } else {
        console.error('❌ Error dropping index:', e);
    }
  } finally {
    process.exit(0);
  }
}

run();
