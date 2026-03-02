/**
 * تنسيق الأرقام مع فواصل المئات (مثال: 1000 -> 1,000)
 * نستخدم en-US لضمان ظهور الفواصل التقليدية التي يفضلها المستخدم
 */
export const formatNumber = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === "") return "";
    const cleanedVal = typeof val === "string" ? val.replace(/,/g, "") : val;
    const num = Number(cleanedVal);
    if (isNaN(num)) return String(val);

    // نستخدم Intl.NumberFormat لضمان الدقة
    return new Intl.NumberFormat("en-US").format(num);
};

/**
 * تنظيف النص من الفواصل لاستخدامه في الحسابات أو الإرسال للسيرفر
 */
export const cleanNumber = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/,/g, "");
};

/**
 * تنسيق المبلغ مع العملة (د.ع)
 */
export const formatCurrency = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === "") return "0 د.ع";
    return `${formatNumber(val)} د.ع`;
};

/**
 * دالة مساعدة للتعامل مع تغيير قيم المدخلات الرقمية مع التنسيق التلقائي
 */
export const handleNumericInputChange = (
    value: string,
    callback: (cleanValue: string) => void
) => {
    const cleanValue = value.replace(/,/g, "");
    // السماح فقط بالأرقام
    if (cleanValue !== "" && !/^\d+$/.test(cleanValue)) return;

    callback(cleanValue);
};
