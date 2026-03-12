import mongoose from "mongoose";
import BalanceRequest from "../models/BalanceRequest.js";
import User from "../models/User.js";
import RefundRequest from "../models/RefundRequest.js";
import FinanceLog from "../models/FinanceLog.js";
import { getIo } from "../utils/socket.js";
import { validateNumber, validateText } from "../utils/validation.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { createLedgerEntry, generateOperationId } from "../utils/ledger.js";

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. تحديث حالة الطلب بشكل ذري لضمان عدم المعالجة مرتين
    const request = await BalanceRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "approved" } },
      { session, new: true }
    );

    if (!request) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Request not found or already processed" });
    }

    // 2. تحديث الرصيد
    const updatedUser = await User.findOneAndUpdate(
      { _id: request.user },
      { $inc: { balance: request.amount } },
      { session, new: true }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    // 3. توثيق السجل المالي
    const receiptId = generateReceiptId();
    const afterBalance = Number(updatedUser.balance || 0);
    const afterHeld = Number(updatedUser.heldBalance || 0);
    const amount = Number(request.amount || 0);
    const beforeBalance = afterBalance - amount;

    await createLedgerEntry({
      session,
      operationId: generateOperationId("manual_topup"),
      userId: request.user,
      type: "WALLET_TOPUP_PAID",
      amountIQD: amount,
      balanceBefore: beforeBalance,
      balanceAfter: afterBalance,
      heldBefore: afterHeld,
      heldAfter: afterHeld,
      referenceModel: "BalanceRequest",
      referenceId: request._id,
      receiptId,
      metadata: { adminId: String(req.user?._id || ""), note: request.note || "شحن يدوي" },
    });

    await session.commitTransaction();
    session.endSession();

    // ✅ إرسال البريد الإلكتروني (خارج الـ transaction لا بأس)
    sendReceiptEmail({
      to: updatedUser.email,
      userName: updatedUser.name,
      receiptId,
      amount: request.amount,
      type: "TOPUP",
      date: new Date(),
      details: request.note || "شحن رصيد يدوي بواسطة الإدارة",
    }).catch((e) => console.error("Email err:", e));

    res.json({ message: "Balance approved and updated" });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// رفض الطلب (قديم/يدوي)
export const rejectBalanceRequest = async (req, res) => {
  try {
    const request = await BalanceRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "rejected" } },
      { new: true }
    );

    if (!request) {
      return res.status(400).json({ message: "Request not found or already processed" });
    }

    res.json({ message: "Balance request rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= WALLET REFUND REQUESTS =================

// POST /api/wallet/refund-request
export const createRefundRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const amountVal = validateNumber(req.body?.amountIQD, { min: 1000, max: 10000000, name: "Refund amount" });
    if (!amountVal.isValid) return res.status(400).json({ message: amountVal.message });
    const amountIQD = amountVal.value;

    const payoutVal = validateText(req.body?.payoutInfo, { min: 10, max: 500, name: "Payout info" });
    if (!payoutVal.isValid) return res.status(400).json({ message: payoutVal.message });
    const payoutInfo = payoutVal.text;

    const noteVal = validateText(req.body?.note || "", { max: 500, name: "Note" });
    if (req.body?.note && !noteVal.isValid) return res.status(400).json({ message: noteVal.message });
    const note = noteVal.text;

    const u = await User.findById(req.user._id).select("blocked").session(session);
    if (!u) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }
    if (u.blocked) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is blocked" });
    }

    const pendingCount = await RefundRequest.countDocuments({
      user: req.user._id,
      status: "pending",
    }).session(session);
    if (pendingCount >= 3) {
      await session.abortTransaction();
      return res.status(400).json({ message: "You already have pending refund requests" });
    }

    const deductedUser = await User.findOneAndUpdate(
      { _id: req.user._id, balance: { $gte: amountIQD } },
      { $inc: { balance: -amountIQD, heldBalance: amountIQD } },
      { new: true, session }
    );

    if (!deductedUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient available balance for refund request" });
    }

    const created = await RefundRequest.create(
      [
        {
          user: req.user._id,
          amountIQD,
          payoutInfo,
          note,
          status: "pending",
        },
      ],
      { session }
    );
    const rr = created[0];

    const afterBalance = Number(deductedUser.balance || 0);
    const afterHeld = Number(deductedUser.heldBalance || 0);
    const beforeBalance = afterBalance + Number(amountIQD || 0);
    const beforeHeld = afterHeld - Number(amountIQD || 0);

    const receiptId = generateReceiptId();
    await createLedgerEntry({
      session,
      operationId: generateOperationId("refund_request_create"),
      userId: req.user._id,
      type: "REFUND_REQUEST_CREATED",
      amountIQD,
      balanceBefore: beforeBalance,
      balanceAfter: afterBalance,
      heldBefore: beforeHeld,
      heldAfter: afterHeld,
      referenceModel: "RefundRequest",
      referenceId: rr._id,
      receiptId,
      metadata: { payoutInfo, note: note || "" },
    });

    await session.commitTransaction();

    const io = getIo();
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.status(201).json(rr);
  } catch (e) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("createRefundRequest error:", e?.message || e);
    return res.status(500).json({ message: "Failed to create refund request" });
  } finally {
    session.endSession();
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const id = req.params.id;
    const adminNote = String(req.body?.adminNote || "").trim();

    // 1. جلب الطلب وتأكيد أنه pending وتحديث حالته بشكل ذري
    const rr = await RefundRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "approved", adminNote, approvedBy: req.user._id, approvedAt: new Date() } },
      { session, new: true }
    );

    if (!rr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Refund request not found or already processed" });
    }

    // 2. التحقق من الرصيد المتاح نخصم بشكل ذري
    // 2. التحقق من الرصيد المحجوز نخصم بشكل ذري
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: rr.user,
        heldBalance: { $gte: rr.amountIQD },
      },
      { $inc: { heldBalance: -rr.amountIQD } },
      { session, new: true }
    );

    if (!updatedUser) {
      // إذا فشل الخصم (رصيد غير كافٍ)، نتراجع عن العملية (Rollback)
      // ونقوم برسمياً برفض الطلب بدلاً من الموافقة
      await session.abortTransaction();
      session.endSession();

      // رفض الطلب تلقائياً لعدم كفاية الرصيد
      await RefundRequest.findByIdAndUpdate(id, {
        status: "rejected",
        adminNote: "Insufficient balance at approval time",
        rejectedBy: req.user._id,
        rejectedAt: new Date(),
      });

      return res.status(400).json({
        message: `رصيد المستخدم غير كافٍ — تم رفض الطلب تلقائياً`,
      });
    }

    // 3. توثيق السجل المالي
    const receiptId = generateReceiptId();
    const signData = { type: "REFUND_REQUEST_APPROVED", user: String(rr.user), amountIQD: rr.amountIQD, receiptId };
    const signature = signReceipt(signData);

    const afterBalance = Number(updatedUser.balance || 0);
    const afterHeld = Number(updatedUser.heldBalance || 0);
    const beforeHeld = afterHeld + Number(rr.amountIQD || 0);

    await createLedgerEntry({
      session,
      operationId: generateOperationId("refund_request_approve"),
      userId: rr.user,
      type: "REFUND_REQUEST_APPROVED",
      amountIQD: rr.amountIQD,
      balanceBefore: afterBalance,
      balanceAfter: afterBalance,
      heldBefore: beforeHeld,
      heldAfter: afterHeld,
      referenceModel: "RefundRequest",
      referenceId: rr._id,
      receiptId,
      metadata: {
        adminId: String(req.user?._id || ""),
        adminName: req.user?.name || "",
        adminNote: adminNote || "",
        signature,
      },
    });

    await session.commitTransaction();
    session.endSession();

    // 4. إرسال البريد الإلكتروني
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
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("adminApproveRefundRequest error:", e);
    return res.status(500).json({ message: "Failed to approve refund request" });
  }
};

// POST /api/admin/refund-requests/:id/reject
export const adminRejectRefundRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const id = req.params.id;
    const adminNote = String(req.body?.adminNote || "").trim();
    const reason = String(req.body?.reason || "").trim();

    const rr = await RefundRequest.findOne({ _id: id, status: "pending" }).session(session);

    if (!rr) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Refund request not found or already processed" });
    }

    const walletBefore = await User.findById(rr.user).select("balance heldBalance").session(session);
    if (!walletBefore) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User wallet not found" });
    }
    const beforeBalance = Number(walletBefore.balance || 0);
    const beforeHeld = Number(walletBefore.heldBalance || 0);
    if (beforeHeld < Number(rr.amountIQD || 0)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient held balance to reject and release this request" });
    }

    const walletUpdate = await User.updateOne(
      { _id: rr.user, balance: beforeBalance, heldBalance: beforeHeld },
      { $inc: { heldBalance: -rr.amountIQD, balance: rr.amountIQD } },
      { session }
    );

    if (walletUpdate.modifiedCount === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient held balance to reject and release this request" });
    }

    rr.status = "rejected";
    rr.adminNote = adminNote;
    rr.rejectedBy = req.user._id;
    rr.rejectedAt = new Date();
    await rr.save({ session });

    const receiptId = generateReceiptId();
    await createLedgerEntry({
      session,
      operationId: generateOperationId("refund_request_reject"),
      userId: rr.user,
      type: "REFUND_REQUEST_REJECTED",
      amountIQD: rr.amountIQD,
      balanceBefore: beforeBalance,
      balanceAfter: beforeBalance + Number(rr.amountIQD || 0),
      heldBefore: beforeHeld,
      heldAfter: beforeHeld - Number(rr.amountIQD || 0),
      referenceModel: "RefundRequest",
      referenceId: rr._id,
      receiptId,
      metadata: {
        adminId: String(req.user?._id || ""),
        adminName: req.user?.name || "",
        reason: reason || adminNote || "",
      },
    });

    await session.commitTransaction();

    const io = getIo();
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.json({ message: "Rejected", refundRequest: rr });
  } catch (e) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("adminRejectRefundRequest error:", e);
    return res.status(500).json({ message: "Failed to reject refund request" });
  } finally {
    session.endSession();
  }
};


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
      receiptId: l.receiptId,
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
