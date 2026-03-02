const fs = require('fs');
const path = 'c:/Users/omar/Desktop/mazad2/pages/AuctionDetails.tsx';
let content = fs.readFileSync(path, 'utf-8');

const oldBlock = `    const handleBidNew = (data: { auction: Auction; bids?: Bid[] }) => {`;
const newHandler = `    const handleBidNew = (data: { auction: Auction; bids?: Bid[] }) => {
      // تطبيق التحديث
      if (!data?.bids) {
        setAuction((prev) => {
          if (!prev) return data.auction;
          if (optimisticBidRef.current !== null) return { ...prev, endTime: data.auction.endTime };
          return data.auction;
        });
      } else {
        applyAuctionUpdate(data as any);
      }

      // ✨ Flash animation on price change
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 900);

      // 🔔 Toast for bids from others
      if (optimisticBidRef.current === null && data.auction?.currentPrice) {
        toast(
          \`⚡ مزايدة جديدة بـ \${data.auction.currentPrice.toLocaleString()} د.ع\`,
          { duration: 3000, style: { fontWeight: 'bold', direction: 'rtl' } }
        );
      }`;

// Find the old handler start and replace until just before "socketRef.current.on"
const startMarker = `    const handleBidNew = (data: { auction: Auction; bids?: Bid[] }) => {`;
const endMarker = `    };


    socketRef.current.on("bid:new", handleBidNew);`;
const newEnd = `    };

    socketRef.current.on("bid:new", handleBidNew);`;

if (content.includes(startMarker)) {
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
        content = content.slice(0, startIdx) + newHandler + '\n    };\n\n    socketRef.current.on("bid:new", handleBidNew);' + content.slice(endIdx + endMarker.length);
        fs.writeFileSync(path, content, 'utf-8');
        console.log('SUCCESS: handler updated');
    } else {
        console.log('END MARKER not found');
    }
} else {
    console.log('START MARKER not found');
}
