const fs = require('fs');
const diff = fs.readFileSync('utf8_diff.patch', 'utf8');
const lines = diff.split('\n');
const corrupted = new Set();
for(let line of lines) {
  if (line.startsWith('+')) {
     const matches = line.match(/["'\]([\x20-\x4A]{4,})["'\]/g);
     if (matches) {
       for(let m of matches) {
          const inner = m.slice(1, -1);
          if (inner.replace(/[0-9 ]/g, '').length === 0) continue;
          if (inner === 'ERR-') continue;
          corrupted.add(inner);
       }
     }
  }
}
console.log(Array.from(corrupted));
