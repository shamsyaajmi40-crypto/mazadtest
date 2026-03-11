const fs = require('fs');

const files = [
  'controllers/adminFinancials.controller.js',
  'controllers/auction.controller.js',
  'controllers/courier.controller.js',
  'cron/auctionPenalty.js',
  'models/Auction.js'
];

for(const f of files) {
  try {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('\uFFFD')) {
       content = content.replace(/\uFFFD/g, '');
       fs.writeFileSync(f, content, 'utf8');
       console.log('Cleaned:', f);
    }
  } catch(e) {
    console.error('Error in', f, e.message);
  }
}
