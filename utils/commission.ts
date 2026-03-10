export const calculateCommission = (finalPrice: number | string): number => {
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
