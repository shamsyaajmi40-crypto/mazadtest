export const calculateCommission = (finalPrice: number | string, startPrice: number | string = 0): number => {
    const finalP = Number(finalPrice) || 0;
    const startP = Number(startPrice) || 0;
    
    // Ensure increase doesn't go below 0
    const increase = Math.max(0, finalP - startP);
    
    let rate = 0;

    if (finalP < 50000) {
        rate = 0.05;       // 5%
    } else if (finalP < 200000) {
        rate = 0.035;      // 3.5%
    } else if (finalP < 500000) {
        rate = 0.025;      // 2.5%
    } else if (finalP < 1000000) {
        rate = 0.018;      // 1.8%
    } else {
        rate = 0.015;      // 1.5%
    }

    const basePercent = 0.005; // 0.5%
    
    const commissionFromIncrease = increase * rate;
    const commissionFromBase = startP * basePercent;
    
    const rawCommission = commissionFromIncrease + commissionFromBase;

    const minCommission = 1000;
    const maxCommission = 50000;

    let finalCommission = Math.ceil(rawCommission);

    // Apply Min/Max constraints first
    if (finalCommission < minCommission) {
        finalCommission = minCommission;
    } else if (finalCommission > maxCommission) {
        finalCommission = maxCommission;
    }

    // Round up to nearest 250 IQD
    const roundedCommission = Math.ceil(finalCommission / 250) * 250;

    return roundedCommission;
};
