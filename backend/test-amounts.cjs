const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mazadtest';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  console.log('FinanceLogs summary:');
  const fl = await db.collection('financelogs').find().sort({_id: -1}).limit(5).toArray();
  for(let p of fl) console.log(p.type, 'amount:', p.amount, 'amountIQD:', p.amountIQD);

  console.log('\nAuditLogs summary:');
  const al = await db.collection('auditlogs').find().sort({_id: -1}).limit(5).toArray();
  for(let p of al) console.log(p.action, 'amount:', p.amount, 'amountIQD:', p.amountIQD);

  console.log('\nPaymentTransactions summary:');
  const pt = await db.collection('paymenttransactions').find().sort({_id: -1}).limit(5).toArray();
  for(let p of pt) console.log(p.kind, 'amount:', p.amount, 'amountIQD:', p.amountIQD);

  process.exit();
}
run();
