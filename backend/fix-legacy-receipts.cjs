const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '.env' });

function generateReceiptId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `MZ-${year}${month}${day}-${random}`;
}

async function run() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mazadtest';
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('financelogs');
    
    let updatedCount = 0;

    // Find documents where receiptId is missing, empty, or starts with ERR-
    const query = {
      $or: [
        { receiptId: { $exists: false } },
        { receiptId: null },
        { receiptId: "" },
        { receiptId: { $regex: /^ERR-/i } }
      ]
    };

    const docsToFix = await collection.find(query).toArray();
    console.log(`Found ${docsToFix.length} legacy finance logs needing a receiptId fix.`);

    for (const doc of docsToFix) {
       await collection.updateOne(
          { _id: doc._id }, 
          { $set: { receiptId: generateReceiptId() } }
       );
       updatedCount++;
    }

    console.log(`✅ Successfully normalized receipt IDs for ${updatedCount} logs.`);
  } catch(e) {
    console.error('❌ Error during legacy fix:', e);
  } finally {
    process.exit(0);
  }
}

run();
