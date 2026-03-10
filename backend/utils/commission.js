// utils/commission.js

/**
 * يحسب مبلغ العمولة بناءً على السعر النهائي للمزاد:
 * - أقل من 50,000       → 5%
 * - 50,000 – 199,999    → 3.5%
 * - 200,000 – 499,999   → 2.5%
 * - 500,000 – 999,999   → 1.8%
 * - 1,000,000 فأكثر     → 1.5%
 * الحد الأدنى: 1,000  |  الحد الأعلى: 20,000
 */
export const calculateCommission = (finalPrice) => {
    const price = Number(finalPrice) || 0;
    let rate = 0;

    if (price < 50000) {
        rate = 0.05;       // 5%
    } else if (price < 200000) {
        rate = 0.035;      // 3.5%
    } else if (price < 500000) {
        rate = 0.025;      // 2.5%
    } else if (price < 1000000) {
        rate = 0.018;      // 1.8%
    } else {
        rate = 0.015;      // 1.5%
    }

    const rawCommission = price * rate;

    const minCommission = 1000;
    const maxCommission = 50000;

    let finalCommission = Math.ceil(rawCommission);

    if (finalCommission < minCommission) {
        finalCommission = minCommission;
    } else if (finalCommission > maxCommission) {
        finalCommission = maxCommission;
    }

    return finalCommission;
};
