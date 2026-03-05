import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import SubscriptionRequest from "../models/SubscriptionRequest.js";
import User from "../models/User.js";
import { sendAppNotification } from "../utils/notification.js";
import { getIo } from "../utils/socket.js";
import { uploadToR2 } from "../utils/r2.js";
import { generateReceiptId } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import FinanceLog from "../models/FinanceLog.js";

const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

// =======================
// USER: Create Request
// POST /api/billing/upgrade-request
// form-data: planCode, receipt (file)
// =======================
export const createUpgradeRequest = async (req, res) => {
  try {
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ message: "planCode مطلوب" });

    const plan = await Plan.findOne({ code: planCode, isActive: true });
    if (!plan) return res.status(404).json({ message: "الباقة غير موجودة" });

    // لازم صورة وصل
    let receipt = null;
    if (req.file) {
      try {
        receipt = await uploadToR2(req.file);
      } catch (err) {
        console.error("Failed to upload receipt to R2:", err);
        return res.status(500).json({ message: "Failed to upload receipt image" });
      }
    }
    if (!receipt) return res.status(400).json({ message: "صورة الوصل مطلوبة" });

    // منع وجود طلب pending سابق
    const pending = await SubscriptionRequest.findOne({
      user: req.user._id,
      status: "pending",
    }).select("_id");
    if (pending) {
      return res.status(409).json({ message: "لديك طلب ترقية قيد المعالجة بالفعل" });
    }

    const request = await SubscriptionRequest.create({
      user: req.user._id,
      plan: plan._id,
      receiptImage: receipt,
      status: "pending",
    });

    const populated = await request.populate("plan", "code name priceIQD audience");
    return res.status(201).json({
      message: "تم إرسال طلب الترقية وهو قيد المعالجة",
      request: populated,
    });
  } catch (err) {
    console.error("createUpgradeRequest error:", err);
    return res.status(500).json({ message: "Failed to create upgrade request" });
  }
};

// =======================
// ADMIN: List Requests
// GET /api/admin/subscription-requests?status=pending|approved|rejected
// =======================
export const listRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await SubscriptionRequest.find(filter)
      .populate("user", "name phone role")
      .populate("plan", "code name priceIQD audience")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("listRequests error:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
};

// =======================
// ADMIN: Approve
// POST /api/admin/subscription-requests/:id/approve
// =======================
export const approveRequest = async (req, res) => {
  try {
    const request = await SubscriptionRequest.findById(req.params.id).populate("plan").populate("user");
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request is not pending" });
    }

    const now = new Date();

    // فعّل/حدث الاشتراك
    let sub = await Subscription.findOne({ user: request.user }).populate("plan");
    if (!sub) {
      sub = await Subscription.create({
        user: request.user,
        plan: request.plan._id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: addOneMonth(now),
        auctionsUsedThisPeriod: 0,
      });
    } else {
      sub.plan = request.plan._id;
      sub.status = "active";
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = addOneMonth(now);
      sub.auctionsUsedThisPeriod = 0;
      await sub.save();
    }

    // حدّث نوع الحساب حسب الباقة
    const audience = request.plan.audience; // user | trader
    await User.updateOne({ _id: request.user }, { $set: { accountType: audience } });

    request.status = "approved";
    request.reviewedBy = req.user._id;
    request.reviewedAt = now;
    await request.save();

    // ✅ إشعار الموافقة على طلب الترقية
    await sendAppNotification({
      userId: request.user._id,
      title: "تهانينا! تمت ترقية حسابك ✅",
      message: `تمت الموافقة على طلبك لترقية الحساب إلى باقة "${request.plan.name}".`,
      event: "SUBSCRIPTION_REQUEST_APPROVED",
      type: "SYSTEM",
    });

    // ✅ Audit & Receipt
    const receiptId = generateReceiptId();
    await FinanceLog.create({
      user: request.user._id,
      type: "SUBSCRIPTION_ACTIVATED",
      amountIQD: request.plan.priceIQD,
      refModel: "SubscriptionRequest",
      refId: request._id,
      receiptId,
      meta: { adminId: req.user._id, planCode: request.plan.code },
    });

    // ✅ Send Receipt Email
    sendReceiptEmail({
      to: request.user.email,
      userName: request.user.name,
      receiptId,
      amount: request.plan.priceIQD,
      type: "SUBSCRIPTION",
      date: new Date(),
      details: `تفعيل باقة "${request.plan.name}" (تحويل يدوي)`
    });

    const populatedReq = await SubscriptionRequest.findById(request._id)
      .populate("user", "name phone role")
      .populate("plan", "code name priceIQD audience");

    return res.json({ message: "Approved", request: populatedReq });
  } catch (err) {
    console.error("approveRequest error:", err);
    return res.status(500).json({ message: "Failed to approve request" });
  }
};

// =======================
// ADMIN: Reject
// POST /api/admin/subscription-requests/:id/reject
// body: { note }
// =======================
export const rejectRequest = async (req, res) => {
  try {
    const { note = "" } = req.body;

    const request = await SubscriptionRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request is not pending" });
    }

    request.status = "rejected";
    request.note = String(note || "");
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    // ✅ إشعار رفض طلب الترقية
    await sendAppNotification({
      userId: request.user,
      title: "تم رفض طلب الترقية ❌",
      message: `نعتذر، تم رفض طلب ترقية الحساب الخاص بك. ${note ? `السبب: ${note}` : ''}`,
      event: "SUBSCRIPTION_REQUEST_REJECTED",
      type: "SYSTEM",
    });

    return res.json({ message: "Rejected" });
  } catch (err) {
    console.error("rejectRequest error:", err);
    return res.status(500).json({ message: "Failed to reject request" });
  }
};
