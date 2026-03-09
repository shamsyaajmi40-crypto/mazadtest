// utils/commission.js

/**
 * يحسب مبلغ العمولة بناءً على السعر النهائي للمزاد حسب القواعد التالية:
 * - أقل من 50,000 → 5%
 * - من 50,000 إلى 499,999 → 3.5%
 * - 500,000 فما فوق → 1.5%
 * الحد الأدنى: 1000
 * الحد الأعلى: 20000
 * 
 * @param {number} finalPrice - السعر النهائي للمزاد المحال
 * @returns {number} - مبلغ العمولة المطلوب
 */
export const calculateCommission = (finalPrice) => {
    const price = Number(finalPrice) || 0;
    let rate = 0;

    if (price < 50000) {
        rate = 0.05; // 5%
    } else if (price < 500000) {
        rate = 0.035; // 3.5%
    } else {
        rate = 0.015; // 1.5%
    }

    const rawCommission = price * rate;

    // تطبيق الحدود
    const minCommission = 1000;
    const maxCommission = 20000;

    let finalCommission = Math.ceil(rawCommission);

    if (finalCommission < minCommission) {
        finalCommission = minCommission;
    } else if (finalCommission > maxCommission) {
        finalCommission = maxCommission;
    }

    return finalCommission;
};
