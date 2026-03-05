import mongoose from "mongoose";
import BalanceRequest from "../models/BalanceRequest.js";
import User from "../models/User.js";
import RefundRequest from "../models/RefundRequest.js";
import FinanceLog from "../models/FinanceLog.js";
import { getIo } from "../utils/socket.js";
import { validateNumber, validateText } from "../utils/validation.js";
import { generateReceiptId } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";

// ================= USER =================

// إنشاء طلب تعبئة (قديم/يدوي)
export const createBalanceRequest = async (req, res) => {
  try {
    const { amount, note } = req.body;

    const amountVal = validateNumber(amount, { min: 1000, max: 10000000, name: "المبلغ" });
    if (!amountVal.isValid) return res.status(400).json({ message: amountVal.message });

    const noteVal = validateText(note, { max: 200, name: "الملاحظة" });
    if (!noteVal.isValid) return res.status(400).json({ message: noteVal.message });

    const request = await BalanceRequest.create({
      user: req.user._id,
      amount: amountVal.value,
      note: noteVal.text,
    });

    // ✅ لا تسجل Refund هنا (كان غلط)
    // إذا تريد تسجل طلب تعبئة يدوي لاحقًا نضيف action خاص.

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= ADMIN =================

// جلب كل الطلبات
export const getAllBalanceRequests = async (req, res) => {
  try {
    const requests = await BalanceRequest.find()
      .populate("user", "name phone balance")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// جلب طلبات المستخدم الخاصة
export const getMyBalanceRequests = async (req, res) => {
  const requests = await BalanceRequest.find({
    user: req.user._id,
  }).sort({ createdAt: -1 });

  res.json(requests);
};

// الموافقة على الطلب (قديم/يدوي)
export const approveBalanceRequest = async (req, res) => {
  try {
    const request = await BalanceRequest.findById(req.params.id);

    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    // ✅ تحديث الرصيد بشكل ذري (Atomic)
    const updatedUser = await User.findOneAndUpdate(
      { _id: request.user },
      { $inc: { balance: request.amount } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    request.status = "approved";
    await request.save();

    // ✅ Audit: شحن رصيد يدوي
    const receiptId = generateReceiptId();
    await FinanceLog.create({
      user: request.user,
      type: "WALLET_TOPUP_PAID",
      amountIQD: request.amount,
      refModel: "BalanceRequest",
      refId: request._id,
      receiptId,
      meta: { adminId: req.user._id, note: request.note || "شحن يدوي" },
    });

    // ✅ Send Receipt Email
    sendReceiptEmail({
      to: updatedUser.email,
      userName: updatedUser.name,
      receiptId,
      amount: request.amount,
      type: "TOPUP",
      date: new Date(),
      details: request.note || "شحن رصيد يدوي بواسطة الإدارة"
    });

    res.json({ message: "Balance approved and updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// رفض الطلب (قديم/يدوي)
export const rejectBalanceRequest = async (req, res) => {
  try {
    const request = await BalanceRequest.findById(req.params.id);

    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    request.status = "rejected";
    await request.save();

    res.json({ message: "Balance request rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= WALLET REFUND REQUESTS =================

// POST /api/wallet/refund-request
export const createRefundRequest = async (req, res) => {
  try {
    const amountVal = validateNumber(req.body?.amountIQD, { min: 1000, max: 10000000, name: "مبلغ الاسترجاع" });
    if (!amountVal.isValid) return res.status(400).json({ message: amountVal.message });
    const amountIQD = amountVal.value;

    const payoutVal = validateText(req.body?.payoutInfo, { min: 10, max: 500, name: "معلومات الدفع" });
    if (!payoutVal.isValid) return res.status(400).json({ message: payoutVal.message });
    const payoutInfo = payoutVal.text;

    const noteVal = validateText(req.body?.note || "", { max: 500, name: "الملاحظة" });
    if (req.body?.note && !noteVal.isValid) return res.status(400).json({ message: noteVal.message });
    const note = noteVal.text;

    const u = await User.findById(req.user._id)
      .select("balance heldBalance blocked")
      .lean();
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.blocked) return res.status(403).json({ message: "Account is blocked" });

    if ((u.balance || 0) < amountIQD) {
      return res
        .status(400)
        .json({ message: "Insufficient available balance for refund" });
    }

    // امنع تكرار طلبات معلقة كثيرة
    const pendingCount = await RefundRequest.countDocuments({
      user: req.user._id,
      status: "pending",
    });
    if (pendingCount >= 3) {
      return res
        .status(400)
        .json({ message: "لديك طلبات استرجاع قيد المراجعة بالفعل" });
    }

    const rr = await RefundRequest.create({
      user: req.user._id,
      amountIQD,
      payoutInfo,
      note,
      status: "pending",
    });

    // ✅ Audit: إنشاء طلب استرجاع
    await FinanceLog.create({
      user: req.user._id,
      type: "REFUND_REQUEST_CREATED",
      amountIQD,
      refModel: "RefundRequest",
      refId: rr._id,
      meta: { payoutInfo, note: note || "" },
    });

    const io = getIo();
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.status(201).json(rr);
  } catch (e) {
    console.error("createRefundRequest error:", e?.message || e);
    return res.status(500).json({ message: "Failed to create refund request" });
  }
};

// GET /api/admin/refund-requests
export const adminListRefundRequests = async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const q = status ? { status } : {};

    const items = await RefundRequest.find(q)
      .populate("user", "name phone balance heldBalance")
      .populate("approvedBy", "name phone")
      .populate("rejectedBy", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(items);
  } catch (e) {
    console.error("adminListRefundRequests error:", e?.message || e);
    return res.status(500).json({ message: "Failed to list refund requests" });
  }
};

// POST /api/admin/refund-requests/:id/approve
export const adminApproveRefundRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const adminNote = String(req.body?.adminNote || "").trim();

    // 1. جلب الطلب وتأكيد أنه pending
    const rr = await RefundRequest.findById(id);
    if (!rr) return res.status(404).json({ message: "Refund request not found" });
    if (rr.status !== "pending") return res.status(400).json({ message: "Request is already processed" });

    // 2. التحقق من الرصيد المتاح بشكل ذري: نخصم فقط إذا كان الرصيد كافياً
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: rr.user,
        balance: { $gte: rr.amountIQD }, // شرط ذري: رفض التحديث إذا كان الرصيد غير كافٍ
      },
      { $inc: { balance: -rr.amountIQD } },
      { new: true }
    );

    if (!updatedUser) {
      // إما المستخدم غير موجود أو الرصيد غير كافٍ — رفض تلقائي
      const userCheck = await User.findById(rr.user).select("balance").lean();
      if (!userCheck) return res.status(404).json({ message: "User not found" });

      // رفض الطلب تلقائياً
      rr.status = "rejected";
      rr.adminNote = "Insufficient balance at approval time";
      rr.rejectedBy = req.user._id;
      rr.rejectedAt = new Date();
      await rr.save();

      await FinanceLog.create({
        user: rr.user,
        type: "REFUND_REQUEST_REJECTED",
        amountIQD: rr.amountIQD,
        refModel: "RefundRequest",
        refId: rr._id,
        meta: { adminId: req.user._id, reason: "Insufficient balance at approval time" },
      });

      const io = getIo();
      if (io) io.to("admin_room").emit("admin_refresh");

      return res.status(400).json({
        message: `رصيد المستخدم (${userCheck.balance?.toLocaleString()} د.ع) غير كافٍ لاسترجاع ${rr.amountIQD?.toLocaleString()} د.ع — تم رفض الطلب تلقائياً`,
      });
    }

    // 3. تحديث الطلب
    rr.status = "approved";
    rr.adminNote = adminNote;
    rr.approvedBy = req.user._id;
    rr.approvedAt = new Date();
    await rr.save();

    // 4. توثيق السجل المالي
    const receiptId = generateReceiptId();
    await FinanceLog.create({
      user: rr.user,
      type: "REFUND_REQUEST_APPROVED",
      amountIQD: rr.amountIQD,
      refModel: "RefundRequest",
      refId: rr._id,
      receiptId,
      meta: {
        adminId: req.user._id,
        adminName: req.user?.name || "",
        adminNote: adminNote || "",
      },
    });

    // 5. إرسال البريد الإلكتروني (اختياري)
    if (updatedUser.email) {
      sendReceiptEmail({
        to: updatedUser.email,
        userName: updatedUser.name,
        receiptId,
        amount: rr.amountIQD,
        type: "WALLET_WITHDRAWAL",
        date: new Date(),
        details: adminNote || "تمت الموافقة على طلب استرجاع الرصيد",
      }).catch((e) => console.error("Email error:", e));
    }

    const io = getIo();
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.json({ message: "Approved and balance deducted", refundRequest: rr });
  } catch (e) {
    console.error("adminApproveRefundRequest error:", e);
    return res.status(500).json({ message: "Failed to approve refund request" });
  }
};

// POST /api/admin/refund-requests/:id/reject
export const adminRejectRefundRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const adminNote = String(req.body?.adminNote || "").trim();
    const reason = String(req.body?.reason || "").trim();

    const rr = await RefundRequest.findById(id);
    if (!rr) return res.status(404).json({ message: "Refund request not found" });
    if (rr.status !== "pending") return res.status(400).json({ message: "Request is already processed" });

    rr.status = "rejected";
    rr.adminNote = adminNote;
    rr.rejectedBy = req.user._id;
    rr.rejectedAt = new Date();
    await rr.save();

    await FinanceLog.create({
      user: rr.user,
      type: "REFUND_REQUEST_REJECTED",
      amountIQD: rr.amountIQD,
      refModel: "RefundRequest",
      refId: rr._id,
      meta: {
        adminId: req.user._id,
        adminName: req.user?.name || "",
        reason: reason || adminNote || "",
      },
    });

    const io = getIo();
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.json({ message: "Rejected", refundRequest: rr });
  } catch (e) {
    console.error("adminRejectRefundRequest error:", e);
    return res.status(500).json({ message: "Failed to reject refund request" });
  }
};

// GET /api/admin/refund-logs?limit=200
// GET /api/admin/refund-logs?limit=200
export const adminRefundLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);

    const logs = await FinanceLog.find({
      type: { $in: ["REFUND_REQUEST_CREATED", "REFUND_REQUEST_APPROVED", "REFUND_REQUEST_REJECTED"] },
    })
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // نخلي نفس schema اللي ينتظره الفرونت: action + amount
    const out = logs.map((l) => ({
      _id: l._id,
      action: l.type,
      amount: l.amountIQD,
      meta: l.meta,
      createdAt: l.createdAt,
      user: l.user,
      refId: l.refId,
    }));

    res.set("Cache-Control", "no-store");
    return res.json(out);
  } catch (e) {
    console.error("adminRefundLogs error:", e?.message || e);
    return res.status(500).json({ message: "Failed to load refund logs" });
  }
};

// GET /api/users/me/financial-logs
export const getMyFinancialLogs = async (req, res) => {
  try {
    const logs = await FinanceLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Mapping to a user-friendly format
    const out = logs.map(l => ({
      _id: l._id,
      type: l.type,
      amount: l.amountIQD,
      receiptId: l.receiptId,
      createdAt: l.createdAt,
      meta: l.meta,
      isImmutable: l.isImmutable
    }));

    return res.json(out);
  } catch (e) {
    console.error("getMyFinancialLogs error:", e);
    return res.status(500).json({ message: "Failed to load your financial history" });
  }
};

