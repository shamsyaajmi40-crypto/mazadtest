// utils/commission.js

/**
 * يحسب مبلغ العمولة باستخدام النظام الهجين (Hybrid Commission):
 * يعتمد على جزأين: عمولة من سعر البداية وعمولة من الزيادة في المزاد.
 * 
 * نسبة العمولة الأساسية (سعر البداية): 0.5%
 * نسب العمولة للزيادة (حسب السعر النهائي):
 * - أقل من 50,000       → 5%
 * - 50,000 – 199,999    → 3.5%
 * - 200,000 – 499,999   → 2.5%
 * - 500,000 – 999,999   → 1.8%
 * - 1,000,000 فأكثر     → 1.5%
 */
export const calculateCommission = (finalPrice, startPrice = 0) => {
    const finalP = Number(finalPrice) || 0;
    const startP = Number(startPrice) || 0;
    
    // Ensure increase doesn't go below 0 if start price was higher than final (shouldn't happen but defensive)
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

    // Round up to nearest 250 IQD to be cash-payable
    const roundedCommission = Math.ceil(finalCommission / 250) * 250;

    return roundedCommission;
};
