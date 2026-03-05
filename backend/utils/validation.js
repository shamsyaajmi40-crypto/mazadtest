import xss from 'xss';

/**
 * يحقّق من صحة رقم الهاتف العراقي
 * التنسيق المتوقع: 07XXXXXXXXX (11 رقماً يبدأ بـ 07)
 */
export const validatePhone = (phone) => {
    if (!phone) return { isValid: false, message: "رقم الهاتف مطلوب" };

    // تنظيف الرقم من المسافات وعلامة +964 إن وجدت
    let cleanPhone = String(phone).trim().replace(/\s+/g, "");
    if (cleanPhone.startsWith("+964")) {
        cleanPhone = "0" + cleanPhone.slice(4);
    } else if (cleanPhone.startsWith("964")) {
        cleanPhone = "0" + cleanPhone.slice(3);
    }

    const phoneRegex = /^07[3-9]\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
        return {
            isValid: false,
            message: "رقم الهاتف غير صحيح. يجب أن يبدأ بـ 07 ويتكون من 11 رقماً."
        };
    }

    return { isValid: true, phone: cleanPhone };
};

/**
 * يحقّق من طول النص ويقوم بتنظيفه
 */
export const validateText = (text, { min = 0, max = 1000, name = "الحقل" } = {}) => {
    // 🛡️ تنظيف النص من أكواد HTML/JavaScript (XSS)
    const sanitizedText = xss(String(text || ""));
    const cleanText = sanitizedText.trim();

    if (min > 0 && cleanText.length < min) {
        return {
            isValid: false,
            message: `${name} قصير جداً، الحد الأدنى ${min} حرف.`
        };
    }

    if (cleanText.length > max) {
        return {
            isValid: false,
            message: `${name} طويل جداً، الحد الأقصى ${max} حرف.`
        };
    }

    return { isValid: true, text: cleanText };
};

/**
 * يحقّق من القيم الرقمية
 */
export const validateNumber = (val, { min = 0, max = Number.MAX_SAFE_INTEGER, name = "القيمة" } = {}) => {
    const num = Number(val);

    if (isNaN(num)) {
        return { isValid: false, message: `${name} يجب أن يكون رقماً صحيحاً.` };
    }

    if (num < min) {
        return { isValid: false, message: `${name} يجب أن لا يقل عن ${min.toLocaleString()}.` };
    }

    if (num > max) {
        return { isValid: false, message: `${name} يجب أن لا يزيد عن ${max.toLocaleString()}.` };
    }

    return { isValid: true, value: num };
};

/**
 * يحقّق من التاريخ (يجب أن يكون في المستقبل)
 */
export const validateFutureDate = (dateVal, { name = "التاريخ", minMinutes = 5 } = {}) => {
    if (!dateVal) return { isValid: true, date: null }; // اختياري

    const date = new Date(dateVal);
    if (isNaN(date.getTime())) {
        return { isValid: false, message: `${name} غير صحيح.` };
    }

    const now = new Date();
    const minAllowed = new Date(now.getTime() + minMinutes * 60 * 1000);

    if (date < minAllowed) {
        return {
            isValid: false,
            message: `${name} يجب أن يكون في المستقبل (على الأقل بعد ${minMinutes} دقائق من الآن).`
        };
    }

    return { isValid: true, date };
};
