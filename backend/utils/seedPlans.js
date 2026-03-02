import Plan from "../models/Plan.js";

export const seedPlansIfEmpty = async () => {
  const count = await Plan.countDocuments();
  if (count > 0) return;

  await Plan.insertMany([
    // USER
    { code: "USER_FREE", audience: "user", name: "مجاني", priceIQD: 0, monthlyAuctionLimit: 2 },
    { code: "USER_PLUS", audience: "user", name: "Plus", priceIQD: 10000, monthlyAuctionLimit: 6 },
    { code: "USER_MAX", audience: "user", name: "Max", priceIQD: 25000, monthlyAuctionLimit: 15 },

    // TRADER
    { code: "TRADER_BASIC", audience: "trader", name: "Trader Basic", priceIQD: 50000, monthlyAuctionLimit: 40 },
    { code: "TRADER_PRO", audience: "trader", name: "Trader Pro", priceIQD: 90000, monthlyAuctionLimit: 100 },
    { code: "TRADER_UNLIMITED", audience: "trader", name: "Unlimited", priceIQD: 150000, isUnlimited: true, fairUseMonthlyLimit: 500 },
  ]);
};
