export const DEFAULT_DEPOSIT_POLICY = {
    bidder: {
        defaultRate: 0.02,
        newUserRate: 0.03,
        newUserAuctionThreshold: 3,
        minAmount: 5000,
        maxAmount: 250000,
    },
    seller: {
        planRates: {
            USER_FREE: 0.03,
            USER_PLUS: 0.015,
            USER_MAX: 0.005,
        },
        strikeSurcharge: {
            oneStrike: 0.01,
            twoPlusStrike: 0.02,
        },
        maxTotalRate: 0.06,
        minAmount: 5000,
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
    const planRatesRaw = sellerRaw?.planRates || {};
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
            planRates: {
                USER_FREE: normalizeRate(
                    planRatesRaw.USER_FREE,
                    DEFAULT_DEPOSIT_POLICY.seller.planRates.USER_FREE
                ),
                USER_PLUS: normalizeRate(
                    planRatesRaw.USER_PLUS,
                    DEFAULT_DEPOSIT_POLICY.seller.planRates.USER_PLUS
                ),
                USER_MAX: normalizeRate(
                    planRatesRaw.USER_MAX,
                    DEFAULT_DEPOSIT_POLICY.seller.planRates.USER_MAX
                ),
            },
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
            smallPriceThreshold: normalizeMoney(
                sellerRaw.smallPriceThreshold,
                DEFAULT_DEPOSIT_POLICY.seller.smallPriceThreshold
            ),
        },
    };
};

export const getSellerDepositRateByPlanAndStrikes = (
    planCode = "USER_FREE",
    strikes = 0,
    policy = DEFAULT_DEPOSIT_POLICY
) => {
    const p = normalizeDepositPolicy(policy);
    const code = String(planCode || "USER_FREE").toUpperCase();
    const s = Number(strikes) || 0;

    const baseRate = code.includes("MAX")
        ? p.seller.planRates.USER_MAX
        : code.includes("PLUS")
            ? p.seller.planRates.USER_PLUS
            : p.seller.planRates.USER_FREE;

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
    planCode = "USER_FREE",
    strikes = 0,
    policy = DEFAULT_DEPOSIT_POLICY
) => {
    const p = normalizeDepositPolicy(policy);
    const price = Math.max(0, Number(startingPrice) || 0);
    const rate = getSellerDepositRateByPlanAndStrikes(planCode, strikes, p);

    if (rate <= 0) return 0;
    if (price < p.seller.smallPriceThreshold) return p.seller.minAmount;
    return Math.max(p.seller.minAmount, Math.ceil(price * rate));
};
