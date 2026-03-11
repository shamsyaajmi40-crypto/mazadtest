const fs = require('fs');

const mappings = {
  "'D3,D :J1 EH,H/": "السجل غير موجود",
  "D' JECF 9C3 BJ/ 9C3J": "لا يمكن عكس قيد عكسي",
  "*E 9C3 G0' 'D3,D E3(BK'": "تم عكس هذا السجل مسبقا",
  "D' JECF *FAJ0 'DBJ/ 'D9C3J D#FG 3J$/J %DI 15J/ 3'D(": "لا يمكن تنفيذ القيد العكسي لانه سيؤدي الى رصيد سالب",
  "*E %F4'! BJ/ 9C3J (F,'- ('D3,D 'D#5DJ DE JO-0A)": "تم انشاء قيد عكسي بنجاح (السجل الاصلي لم يحذف)",
  "A4D %F4'! 'DBJ/ 'D9C3J": "فشل انشاء القيد العكسي",
  "A4D AJ ,D( 3,D'* 'D*EJJA": "فشل في جلب سجلات التمييز",
  "15J/C :J1 C'A K DA*- 91(HF 'DE2'J/) AJ G0' 'DE2'/": "رصيدك غير كاف لفتح عربون المزايدة في هذا المزاد",
  "*E /A9 9EHD) 'DE2'/ + *,/J/ 'D(B') %DI": "تم دفع عمولة المزاد + تجديد الباقة الى",
  // Fallbacks: If there are others, I will apply a general replace to anything looking deeply corrupted.
};

const files = [
  'controllers/adminFinancials.controller.js',
  'controllers/auction.controller.js',
  'controllers/courier.controller.js',
  'cron/auctionPenalty.js',
  'models/Auction.js'
];

for(const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  // 1. Exact string replacements
  for(const [bad, good] of Object.entries(mappings)) {
    if(content.includes(bad)) {
       content = content.replace(new RegExp(bad.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g'), good);
       changed = true;
    }
  }

  // 2. Automated generic Arabic string translation logic for anything structurally similar inside "message: ...", reason, note etc
  // Looking for keys like `message: "AAA BBD"` without english lowercase.
  content = content.replace(/(message|reason|note|details|title|event|type)\s*:\s*([`"'])([^`"a-z]+)\2/g, (match, key, quote, inner) => {
     // A valid corrupted Arabic string shouldn't contain standard uppercase english words alone like "ERROR" 
     if (/^[A-Z_0-9\s]+$/.test(inner)) return match; // skip "SYSTEM" or "ERROR"
     
     if (inner.includes(' ') && inner.length > 5) { // Needs spaces, e.g. "D' J"
        let arabic = '';
        for(let i=0; i<inner.length; i++) {
           let code = inner.charCodeAt(i);
           if (code >= 0x21 && code <= 0x4A) {
              code += 0x0600;
           } else if (code >= 0x60 && code <= 0x69) {
              code += 0x0600;
           }
           arabic += String.fromCharCode(code);
        }
        changed = true;
        return `${key}: ${quote}${arabic}${quote}`;
     }
     return match;
  });

  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Successfully repaired:', f);
  }
}
