import crypto from "crypto";

/**
 * Generates a unique, immutable Receipt ID
 * Format: MZ-YYYYMMDD-XXXX
 * Example: MZ-20240303-A7B2
 */
export const generateReceiptId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();

    return `MZ-${year}${month}${day}-${random}`;
};

/**
 * Creates a digital signature for the receipt details (Integrity Check)
 */
export const signReceipt = (data) => {
    const secret = process.env.RECEIPT_SECRET;
    
    if (!secret) {
        console.error("CRITICAL SECURITY ERROR: RECEIPT_SECRET is not defined in environment variables.");
        throw new Error("Internal Server Configuration Error: Cannot sign receipt securely.");
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
};
