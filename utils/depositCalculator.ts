export const DEFAULT_DEPOSIT_POLICY = {
    bidder: {
        defaultRate: 0.02,
        newUserRate: 0.03,
        newUserAuctionThreshold: 3,
        minAmount: 5000,
        maxAmount: 250000,
    },
    seller: {
        defaultRate: 0.03,
        strikeSurcharge: {
            oneStrike: 0.01,
            twoPlusStrike: 0.02,
        },
        maxTotalRate: 0.06,
        minAmount: 5000,
        maxAmount: 250000,
        smallPriceThreshold: 100000,
    },
};

const toFinite = (value: any, fallback: number) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const clamp = (num: number, min: number, max: number) => Math.max(min, Math.min(max, num));

const normalizeRate = (value: any, fallback: number) => clamp(toFinite(value, fallback), 0, 1);
const normalizeMoney = (value: any, fallback: number) => Math.max(0, Math.ceil(toFinite(value, fallback)));
const normalizeCount = (value: any, fallback: number) => Math.max(0, Math.floor(toFinite(value, fallback)));

export const normalizeDepositPolicy = (raw: any = {}) => {
    const bidderRaw = raw?.bidder || {};
    const sellerRaw = raw?.seller || {};
    const strikeRaw = sellerRaw?.strikeSurcharge || {};

    const bidderMin = normalizeMoney(bidderRaw.minAmount, DEFAULT_DEPOSIT_POLICY.bidder.minAmount);
    const bidderMaxRaw = normalizeMoney(bidderRaw.maxAmount, DEFAULT_DEPOSIT_POLICY.bidder.maxAmount);
    const bidderMax = Math.max(bidderMin, bidderMaxRaw);

    return {
        bidder: {
            defaultRate: normalizeRate(bidderRaw.defaultRate, DEFAULT_DEPOSIT_POLICY.bidder.defaultRate),
            newUserRate: normalizeRate(bidderRaw.newUserRate, DEFAULT_DEPOSIT_POLICY.bidder.newUserRate),
            newUserAuctionThreshold: normalizeCount(
                bidderRaw.newUserAuctionThreshold,
                DEFAULT_DEPOSIT_POLICY.bidder.newUserAuctionThreshold
            ),
            minAmount: bidderMin,
            maxAmount: bidderMax,
        },
        seller: {
            defaultRate: normalizeRate(
                sellerRaw.defaultRate,
                DEFAULT_DEPOSIT_POLICY.seller.defaultRate
            ),
            strikeSurcharge: {
                oneStrike: normalizeRate(
                    strikeRaw.oneStrike,
                    DEFAULT_DEPOSIT_POLICY.seller.strikeSurcharge.oneStrike
                ),
                twoPlusStrike: normalizeRate(
                    strikeRaw.twoPlusStrike,
                    DEFAULT_DEPOSIT_POLICY.seller.strikeSurcharge.twoPlusStrike
                ),
            },
            maxTotalRate: normalizeRate(sellerRaw.maxTotalRate, DEFAULT_DEPOSIT_POLICY.seller.maxTotalRate),
            minAmount: normalizeMoney(sellerRaw.minAmount, DEFAULT_DEPOSIT_POLICY.seller.minAmount),
            maxAmount: Math.max(
                normalizeMoney(sellerRaw.minAmount, DEFAULT_DEPOSIT_POLICY.seller.minAmount),
                normalizeMoney(sellerRaw.maxAmount, DEFAULT_DEPOSIT_POLICY.seller.maxAmount)
            ),
            smallPriceThreshold: normalizeMoney(
                sellerRaw.smallPriceThreshold,
                DEFAULT_DEPOSIT_POLICY.seller.smallPriceThreshold
            ),
        },
    };
};

export const getSellerDepositRateByStrikes = (
    strikes = 0,
    policy = DEFAULT_DEPOSIT_POLICY
) => {
    const p = normalizeDepositPolicy(policy);
    const s = Number(strikes) || 0;

    const baseRate = p.seller.defaultRate;

    const surcharge =
        s >= 2
            ? p.seller.strikeSurcharge.twoPlusStrike
            : s >= 1
                ? p.seller.strikeSurcharge.oneStrike
                : 0;

    return clamp(baseRate + surcharge, 0, p.seller.maxTotalRate);
};

export const calculateSellerDeposit = (
    startingPrice: number | string,
    strikes = 0,
    policy = DEFAULT_DEPOSIT_POLICY
) => {
    const p = normalizeDepositPolicy(policy);
    const price = Math.max(0, Number(startingPrice) || 0);
    const rate = getSellerDepositRateByStrikes(strikes, p);

    if (rate <= 0) return 0;
    if (price < p.seller.smallPriceThreshold) return p.seller.minAmount;
    const rawAmount = Math.ceil(price * rate);
    const withMin = Math.max(p.seller.minAmount, rawAmount);
    return Math.min(p.seller.maxAmount || 250000, withMin);
};
