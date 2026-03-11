import mongoose from "mongoose";
import User from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { sendAppNotification } from "../utils/notification.js";

import { createPayment, getPaymentStatus } from "../utils/zaincashV2.js";
import { v4 as uuidv4 } from "uuid";
import { generateReceiptId } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { createLedgerEntry, ensureIntegerIQD, generateOperationId } from "../utils/ledger.js";

const requireUser = (req, res) => {
  if (!req.user?._id) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
};

// Default to mock mode unless explicitly set to false
const isMock = () => process.env.ZC_MOCK_MODE !== "false";

// Safe fallback for redirect URL.
const ZC_REDIRECT_URL =
  process.env.ZC_REDIRECT_URL ||
  (process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/payments/zaincash/redirect`
    : "http://localhost:5000/api/payments/zaincash/redirect");

// =====================================================
// INIT WALLET TOPUP
// =====================================================
export const initZaincashTopup = async (req, res) => {
  try {
    if (!requireUser(req, res)) return;

    const amount = Number(req.body?.amountIQD || 0);
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1000) {
      return res.status(400).json({
        message: "المبلغ يجب أن يكون رقمًا صحيحًا (IQD) وبحد أدنى 1000",
      });
    }

    const orderId = `TOPUP_${req.user._id}_${Date.now()}`;

    await PaymentTransaction.create({
      user: req.user._id,
      kind: "wallet_topup",
      amountIQD: amount,
      orderId,
      status: "initiated",
      provider: "zaincash",
    });

    // ================= MOCK =================
    if (isMock()) {
      const fakeTransactionId = "MOCK_" + Date.now();

      await PaymentTransaction.updateOne(
        { orderId },
        {
          $set: {
            transactionId: fakeTransactionId,
            rawInitResponse: { mock: true },
          },
        }
      );

      const paymentUrl = `${ZC_REDIRECT_URL}?transactionId=${fakeTransactionId}&orderId=${orderId}`;

      return res.json({
        paymentUrl,
        transactionId: fakeTransactionId,
        orderId,
        mock: true,
      });
    }

    // ================= REAL =================
    const externalReferenceId = uuidv4();

    const paymentData = await createPayment({
      amount,
      serviceType: "MERCHANT_PAYMENT",
      externalReferenceId,
      redirectUrl: ZC_REDIRECT_URL,
      msisdn: process.env.ZC_MSISDN,
    });

    const transactionId = paymentData.transactionId;

    await PaymentTransaction.updateOne(
      { orderId },
      {
        $set: {
          transactionId,
          rawInitResponse: paymentData,
        },
      }
    );

    return res.json({
      paymentUrl: paymentData.paymentUrl,
      transactionId,
      orderId,
    });
  } catch (err) {
    console.error("initZaincashTopup:", err?.response?.data || err);
    return res.status(500).json({
      message: "Failed to init topup",
      error: err?.response?.data || err.message,
    });
  }
};

// =====================================================
// REDIRECT / VERIFY
// =====================================================
export const zaincashRedirect = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { transactionId, orderId } = req.query;

    const FRONTEND_SUCCESS_URL = process.env.FRONTEND_SUCCESS_URL || "/";
    const FRONTEND_FAIL_URL = process.env.FRONTEND_FAIL_URL || "/";
    const FRONTEND_WALLET_SUCCESS_URL = process.env.FRONTEND_WALLET_SUCCESS_URL || "/#/wallet?paid=1";
    const FRONTEND_WALLET_FAIL_URL = process.env.FRONTEND_WALLET_FAIL_URL || "/#/wallet?paid=0";

    if (!transactionId || !orderId) {
      return res.redirect(`${FRONTEND_FAIL_URL}&reason=missing_params`);
    }

    const tx = await PaymentTransaction.findOne({ orderId }).populate("user");
    if (!tx) {
      const failUrl = req.query.kind === "wallet_topup" ? FRONTEND_WALLET_FAIL_URL : FRONTEND_FAIL_URL;
      return res.redirect(`${failUrl}&reason=tx_not_found`);
    }

    if (tx.transactionId && String(tx.transactionId) !== String(transactionId)) {
      const failUrl = tx.kind === "wallet_topup" ? FRONTEND_WALLET_FAIL_URL : FRONTEND_FAIL_URL;
      return res.redirect(`${failUrl}&reason=tx_mismatch`);
    }

    // Idempotency guard: already processed successfully.
    if (tx.status === "paid") {
      if (tx.kind === "wallet_topup") {
        return res.redirect(
          `${FRONTEND_WALLET_SUCCESS_URL}&topup=1&orderId=${encodeURIComponent(orderId)}&duplicate=1`
        );
      }
      return res.redirect(`${FRONTEND_SUCCESS_URL}&orderId=${encodeURIComponent(orderId)}&duplicate=1`);
    }

    let isPaid = true;

    // ================= REAL MODE CHECK =================
    if (!isMock()) {
      const statusData = await getPaymentStatus(transactionId);

      await PaymentTransaction.updateOne(
        { _id: tx._id },
        { $set: { rawStatusResponse: statusData } }
      );

      const status = String(statusData.status || "").toLowerCase();
      isPaid = status === "completed" || status === "success" || status === "paid";
    }

    if (!isPaid) {
      await PaymentTransaction.updateOne(
        { _id: tx._id, status: { $ne: "paid" } },
        { $set: { status: "failed" } }
      );

      const failUrl = tx.kind === "wallet_topup" ? FRONTEND_WALLET_FAIL_URL : FRONTEND_FAIL_URL;
      return res.redirect(`${failUrl}&reason=not_paid`);
    }

    // ================= WALLET =================
    if (tx.kind === "wallet_topup") {
      await session.startTransaction();

      const lockedTx = await PaymentTransaction.findOneAndUpdate(
        { _id: tx._id, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            receiptId: tx.receiptId || generateReceiptId(),
            transactionId: String(transactionId || tx.transactionId || ""),
          },
        },
        { new: true, session }
      );

      if (!lockedTx) {
        await session.abortTransaction();
        return res.redirect(
          `${FRONTEND_WALLET_SUCCESS_URL}&topup=1&orderId=${encodeURIComponent(orderId)}&duplicate=1`
        );
      }

      const amountIQD = ensureIntegerIQD(lockedTx.amountIQD, "amountIQD");
      const userBefore = await User.findById(lockedTx.user).select("balance heldBalance").session(session);
      if (!userBefore) {
        throw new Error("Wallet owner not found");
      }

      const beforeBalance = Number(userBefore.balance || 0);
      const beforeHeld = Number(userBefore.heldBalance || 0);

      const walletUpdate = await User.updateOne(
        { _id: lockedTx.user, balance: beforeBalance, heldBalance: beforeHeld },
        { $inc: { balance: amountIQD } },
        { session }
      );

      if (walletUpdate.modifiedCount === 0) {
        throw new Error("Wallet update conflict while crediting topup");
      }

      await createLedgerEntry({
        session,
        operationId: String(transactionId || generateOperationId("zc_topup")),
        userId: lockedTx.user,
        type: "WALLET_TOPUP_PAID",
        amountIQD,
        balanceBefore: beforeBalance,
        balanceAfter: beforeBalance + amountIQD,
        heldBefore: beforeHeld,
        heldAfter: beforeHeld,
        referenceModel: "PaymentTransaction",
        referenceId: lockedTx._id,
        receiptId: lockedTx.receiptId,
        metadata: {
          orderId,
          provider: "zaincash",
          transactionId: String(transactionId || ""),
          callbackMode: isMock() ? "mock" : "real",
        },
      });

      await session.commitTransaction();

      sendReceiptEmail({
        to: tx.user?.email,
        userName: tx.user?.name,
        receiptId: lockedTx.receiptId,
        amount: amountIQD,
        type: "TOPUP",
        date: new Date(),
        details: `شحن محفظة عبر زين كاش (Order: ${orderId})`,
      }).catch((e) => console.error("sendReceiptEmail error:", e));

      await sendAppNotification({
        userId: tx.user,
        title: "تم شحن المحفظة بنجاح 💰",
        message: `تم استلام مبلغ ${amountIQD.toLocaleString()} د.ع عبر زين كاش وإضافته لمحفظتك.`,
        event: "WALLET_TOPUP_PAID",
        type: "SYSTEM",
      });

      return res.redirect(
        `${FRONTEND_WALLET_SUCCESS_URL}&topup=1&orderId=${encodeURIComponent(orderId)}`
      );
    }

    await PaymentTransaction.updateOne(
      { _id: tx._id, status: { $ne: "paid" } },
      {
        $set: {
          status: "paid",
          transactionId: String(transactionId || tx.transactionId || ""),
        },
      }
    );

    return res.redirect(`${FRONTEND_SUCCESS_URL}&orderId=${encodeURIComponent(orderId)}`);
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("zaincashRedirect:", err);
    const fail = process.env.FRONTEND_FAIL_URL || "/";
    return res.redirect(`${fail}&reason=exception`);
  } finally {
    session.endSession();
  }
};

// =====================================================
// STATUS CHECK
// =====================================================
export const zaincashStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const tx = await PaymentTransaction.findOne({
      user: req.user._id,
      orderId,
    });

    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    return res.json({
      orderId: tx.orderId,
      transactionId: tx.transactionId,
      status: tx.status,
      amountIQD: tx.amountIQD,
      updatedAt: tx.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get status" });
  }
};
