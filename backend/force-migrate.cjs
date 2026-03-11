const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '.env' });

async function run() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mazadtest';
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    const collection = db.collection('financelogs');
    
    let count = 0;

    // 1. Drop existing operationId index so it doesn't block updates
    try {
      await collection.dropIndex('operationId_1');
      console.log('✅ Dropped operationId_1 index.');
    } catch (e) {
      console.log('ℹ️ operationId_1 index not found or already dropped.');
    }

    // 2. Find anything where operationId is missing, null, empty string, or not a string
    const query = {
      $or: [
        { operationId: { $exists: false } },
        { operationId: null },
        { operationId: "" }
      ]
    };

    const docsToFix = await collection.find(query).toArray();
    console.log(`Found ${docsToFix.length} documents requiring an operationId.`);

    for (const doc of docsToFix) {
       await collection.updateOne(
          { _id: doc._id }, 
          { $set: { operationId: `legacy_${crypto.randomUUID()}` } }
       );
       count++;
    }

    console.log(`✅ Assigned unique operationIds to ${count} FinanceLogs.`);
  } catch(e) {
    console.error('❌ Error:', e);
  } finally {
    process.exit(0);
  }
}

run();
