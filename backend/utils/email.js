import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends a financial receipt to the user's email
 */
export const sendReceiptEmail = async ({ to, userName, receiptId, amount, type, date, details }) => {
    if (!to) {
        console.warn("⚠️ No email provided to send receipt.");
        return;
    }

    const typeLabels = {
        "TOPUP": "شحن رصيد",
        "SUBSCRIPTION": "اشتراك باقة",
        "DEPOSIT_REFUND": "إرجاع عربون",
        "WALLET_WITHDRAWAL": "سحب رصيد",
        "PENALTY": "مصادرة رصيد",
    };

    const label = typeLabels[type] || type;

    const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #0f172a; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">وصل مالي - MAZAD</h1>
            <p style="opacity: 0.8; margin-top: 10px;">عملية ناجحة</p>
        </div>
        
        <div style="padding: 40px; background-color: white;">
            <div style="text-align: center; margin-bottom: 30px;">
                <p style="color: #64748b; font-size: 14px; margin-bottom: 5px;">إجمالي المبلغ</p>
                <h2 style="color: #0f172a; font-size: 32px; font-weight: 900; margin: 0;">${new Intl.NumberFormat("ar-IQ").format(amount)} د.ع</h2>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 15px 0; color: #64748b; font-size: 14px;">رقم الوصل</td>
                    <td style="padding: 15px 0; color: #0f172a; font-weight: bold; text-align: left; font-family: monospace;">${receiptId}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 15px 0; color: #64748b; font-size: 14px;">المستخدم</td>
                    <td style="padding: 15px 0; color: #0f172a; font-weight: bold; text-align: left;">${userName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 15px 0; color: #64748b; font-size: 14px;">النوع</td>
                    <td style="padding: 15px 0; color: #0f172a; font-weight: bold; text-align: left;">${label}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 15px 0; color: #64748b; font-size: 14px;">التاريخ</td>
                    <td style="padding: 15px 0; color: #0f172a; font-weight: bold; text-align: left;">${new Date(date).toLocaleString("ar-IQ")}</td>
                </tr>
            </table>
            
            ${details ? `
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin-bottom: 10px; font-weight: bold;">تفاصيل إضافية</p>
                <p style="color: #0f172a; font-size: 14px; margin: 0; line-height: 1.6;">${details}</p>
            </div>
            ` : ''}
        </div>
        
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
            <p>هذا الوصل معتمد إلكترونياً ومنشور في سجل معاملاتك بمنصة MAZAD.</p>
            <p>&copy; ${new Date().getFullYear()} MAZAD Application. All rights reserved.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: `"MAZAD Financial" <${process.env.EMAIL_FROM}>`,
            to,
            subject: `وصل مالي - ${label} (#${receiptId})`,
            html,
        });
        console.log(`✅ Receipt email sent to ${to}: ${receiptId}`);
    } catch (error) {
        console.error("❌ Failed to send receipt email:", error);
    }
};
