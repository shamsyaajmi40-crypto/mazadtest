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

    // 1. Find documents missing operationId entirely
    const missingDocs = await collection.find({ operationId: { $exists: false } }).toArray();
    for (const doc of missingDocs) {
       await collection.updateOne(
          { _id: doc._id }, 
          { $set: { operationId: `legacy_${crypto.randomUUID()}` } }
       );
       count++;
    }
    
    // 2. Find documents where operationId is explicitly null
    const nullDocs = await collection.find({ operationId: null }).toArray();
    for (const doc of nullDocs) {
       await collection.updateOne(
          { _id: doc._id }, 
          { $set: { operationId: `legacy_null_${crypto.randomUUID()}` } }
       );
       count++;
    }

    console.log(`✅ Successfully generated and assigned unique operationIds to ${count} legacy FinanceLogs.`);
    
    // Additionally, try dropping the old index just in case there's a cached partial one
    try {
       await collection.dropIndex('operationId_1');
       console.log('ℹ️ Dropped existing operationId_1 index to let syncIndexes rebuild it cleanly.');
    } catch(err) {
       // Ignore if not exists
    }

  } catch(e) {
    console.error('❌ Error in migration:', e);
  } finally {
    process.exit(0);
  }
}

run();
