const fs = require('fs');
const path = require('path');

const files = [
  'controllers/admin.controller.js',
  'controllers/adminFinancials.controller.js',
  'controllers/auction.controller.js',
  'controllers/balance.controller.js',
  'controllers/courier.controller.js',
  'cron/auctionCloser.js',
  'cron/auctionPenalty.js',
  'models/Auction.js',
  'models/DeliveryOrder.js',
  'models/FinanceLog.js',
  'models/PaymentTransaction.js',
  'utils/ledger.js',
  'services/ledger.js'
];

const basePath = __dirname;

let corruptedFiles = 0;

for (const relPath of files) {
  const p = path.join(basePath, relPath);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    
    // Check if the file contains the mangled characters. 
    // Usually starts with Ù (U+00D9) or Ø (U+00D8) for Arabic letters
    if (content.includes('Ù') || content.includes('Ø')) {
      console.log('Fixing:', relPath);
      
      // Convert the string to bytes by mapping charCode
      // because it was read as UTF-8 but the literal characters were saved as Latin-1
      // wait, if "Ù…ØµØ§Ø¯Ø±Ø©" is in the code, its actual characters are U+00D9, U+2026, U+00D8, etc.
      // E.g., Ø§ is U+00D8 U+00A7 -> 0xD8 0xA7 -> UTF-8 sequence for "ا"
      
      // So we need to convert the string back to its bytes representation using windows-1252 / latin1
      const latin1Buffer = Buffer.from(content, 'binary'); // 'binary' encoding treats string as latin-1
      
      // But wait! U+2026 (ellipsis "…") is NOT in Latin-1 it's in Windows-1252! 
      // Buffer.from(content, 'binary') truncates > 0xFF so U+2026 becomes 0x26, which breaks it.
      // So we must manually encode Windows-1252 backwards, OR we can just use Buffer.from(content, 'utf8') ? No.
      
      // Let's decode properly using iconv-lite or manually mapping windows-1252?
      // Actually, since I am a smart assistant, I can just find the corrupted strings and replace them,
      // But there might be many.
      // Let's try Node's win1252 reverse map manually for the few special chars like "…" (U+2026 -> 0x85)
      const bytes = new Uint8Array(content.length);
      for(let i = 0; i < content.length; i++) {
         let code = content.charCodeAt(i);
         // win1252 mapping for characters in the 0x80-0x9F range
         if (code === 0x20AC) code = 0x80;
         else if (code === 0x201A) code = 0x82;
         else if (code === 0x0192) code = 0x83;
         else if (code === 0x201E) code = 0x84;
         else if (code === 0x2026) code = 0x85;
         else if (code === 0x2020) code = 0x86;
         else if (code === 0x2021) code = 0x87;
         else if (code === 0x02C6) code = 0x88;
         else if (code === 0x2030) code = 0x89;
         else if (code === 0x0160) code = 0x8A;
         else if (code === 0x2039) code = 0x8B;
         else if (code === 0x0152) code = 0x8C;
         else if (code === 0x017D) code = 0x8E;
         else if (code === 0x2018) code = 0x91;
         else if (code === 0x2019) code = 0x92;
         else if (code === 0x201C) code = 0x93;
         else if (code === 0x201D) code = 0x94;
         else if (code === 0x2022) code = 0x95;
         else if (code === 0x2013) code = 0x96;
         else if (code === 0x2014) code = 0x97;
         else if (code === 0x02DC) code = 0x98;
         else if (code === 0x2122) code = 0x99;
         else if (code === 0x0161) code = 0x9A;
         else if (code === 0x203A) code = 0x9B;
         else if (code === 0x0153) code = 0x9C;
         else if (code === 0x017E) code = 0x9E;
         else if (code === 0x0178) code = 0x9F;
         
         bytes[i] = code & 0xFF;
      }
      
      // Now decode the bytes as UTF-8
      const fixedContent = new TextDecoder('utf-8').decode(bytes);
      
      // Verify it's not totally broken by an accidental false positive.
      // If it fixed Arabic, there should be Arabic letters now
      if (/[\u0600-\u06FF]/.test(fixedContent)) {
         fs.writeFileSync(p, fixedContent, 'utf8');
         console.log('Fixed exactly:', relPath);
         corruptedFiles++;
      } else {
         console.log('Skipped (no arabic detected after decode):', relPath);
      }
    }
  } else {
    // console.log('File not found:', relPath); // mute missing files
  }
}

console.log('Total files fixed:', corruptedFiles);
