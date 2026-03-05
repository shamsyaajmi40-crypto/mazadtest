import Notification from "../models/Notification.js";
import { getIo } from "./socket.js";

/**
 * دالة موحدة لإنشاء الإشعارات وإرسالها عبر WebSockets
 * 
 * @param {Object} params
 * @param {mongoose.Types.ObjectId | string} params.userId - معرف المستخدم المستلم
 * @param {string} params.title - عنوان الإشعار
 * @param {string} params.message - نص الإشعار
 * @param {string} params.event - نوع الحدث البرمجي للإشعار
 * @param {string} [params.type="SYSTEM"] - تصنيف الإشعار
 * @param {mongoose.Types.ObjectId | string} [params.auctionId] - معرف المزاد المرتبط (اختياري)
 */
export const sendAppNotification = async ({
    userId,
    title,
    message,
    event = "SYSTEM",
    type = "SYSTEM",
    auctionId = null,
}) => {
    if (!userId) return null;

    try {
        const notification = await Notification.create({
            user: userId,
            type,
            event,
            title,
            message,
            auction: auctionId,
        });

        const io = getIo();
        if (io) {
            io.to(userId.toString()).emit("new_notification", notification);

            // تحديث واجهة المستخدم بشكل عام في بعض الأحيان (اختياري، مأخوذ من courier.controller.js)
            // io.to(userId.toString()).emit("user_refresh"); 
        }

        return notification;
    } catch (error) {
        console.error("Failed to send app notification:", error);
        // عدم كسر التنفيذ في حال فشل الإشعار
        return null;
    }
};
