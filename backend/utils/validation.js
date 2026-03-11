import xss from "xss";

/**
 * Validate Iraqi phone number.
 * Expected format: 07XXXXXXXXX
 */
export const validatePhone = (phone) => {
  if (!phone) return { isValid: false, message: "رقم الهاتف مطلوب" };

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
      message: "رقم الهاتف غير صحيح. يجب أن يبدأ بـ 07 ويتكون من 11 رقمًا.",
    };
  }

  return { isValid: true, phone: cleanPhone };
};

/**
 * Validate and sanitize text.
 */
export const validateText = (text, { min = 0, max = 1000, name = "الحقل" } = {}) => {
  const sanitizedText = xss(String(text || ""));
  const cleanText = sanitizedText.trim();

  if (min > 0 && cleanText.length < min) {
    return {
      isValid: false,
      message: `${name} قصير جدًا، الحد الأدنى ${min} حرف.`,
    };
  }

  if (cleanText.length > max) {
    return {
      isValid: false,
      message: `${name} طويل جدًا، الحد الأقصى ${max} حرف.`,
    };
  }

  return { isValid: true, text: cleanText };
};

/**
 * Validate numeric values (IQD by default).
 */
export const validateNumber = (
  val,
  { min = 0, max = Number.MAX_SAFE_INTEGER, name = "القيمة", integer = true } = {}
) => {
  const num = Number(val);

  if (!Number.isFinite(num)) {
    return { isValid: false, message: `${name} يجب أن يكون رقمًا صحيحًا.` };
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, message: `${name} يجب أن يكون رقمًا صحيحًا بدون كسور.` };
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
 * Validate future date.
 */
export const validateFutureDate = (dateVal, { name = "التاريخ", minMinutes = 5 } = {}) => {
  if (!dateVal) return { isValid: true, date: null };

  const date = new Date(dateVal);
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, message: `${name} غير صحيح.` };
  }

  const now = new Date();
  const minAllowed = new Date(now.getTime() + minMinutes * 60 * 1000);

  if (date < minAllowed) {
    return {
      isValid: false,
      message: `${name} يجب أن يكون في المستقبل (على الأقل بعد ${minMinutes} دقائق من الآن).`,
    };
  }

  return { isValid: true, date };
};
