const fs = require('fs');

const diff = fs.readFileSync('utf8_diff.patch', 'utf8');
const lines = diff.split('\n');

const corruptedMap = new Map();

for (let i = 0; i < lines.length - 1; i++) {
   if (lines[i].startsWith('-') && lines[i+1].startsWith('+')) {
      // Find Arabic strings in the minus line
      const arMatch = lines[i].match(/(["'`])([\u0600-\u06FF]+(?:[\s\u0600-\u06FF0-9a-zA-Z,\.\-()!]*?))\1/g);
      const enMatch = lines[i+1].match(/(["'`])([\x20-\x5F]+)\1/g);
      
      if (arMatch && enMatch && arMatch.length === enMatch.length) {
         for(let j=0; j<arMatch.length; j++) {
            const arStr = arMatch[j].slice(1, -1);
            const enStr = enMatch[j].slice(1, -1);
            if (arStr.length > 2 && enStr.length > 2 && arStr !== enStr) {
               corruptedMap.set(enStr, arStr);
            }
         }
      }
   }
}

console.log(JSON.stringify(Object.fromEntries(corruptedMap), null, 2));

