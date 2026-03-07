import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { sendAppNotification } from "../utils/notification.js";
import { getIo } from "../utils/socket.js";

import { createPayment, getPaymentStatus } from "../utils/zaincashV2.js";
import { v4 as uuidv4 } from "uuid";
import { generateReceiptId } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import FinanceLog from "../models/FinanceLog.js";

const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const requireUser = (req, res) => {
  if (!req.user?._id) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
};

// Default to mock mode unless explicitly set to false
const isMock = () => process.env.ZC_MOCK_MODE !== "false";

// Safe fallback for the redirect URL
// If ZC_REDIRECT_URL is missing, we try to use BACKEND_URL. 
// If both are missing, we default to localhost for development.
const ZC_REDIRECT_URL =
  process.env.ZC_REDIRECT_URL ||
  (process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/payments/zaincash/redirect`
    : "http://localhost:5000/api/payments/zaincash/redirect");


// =====================================================
// INIT SUBSCRIPTION
// =====================================================
export const initZaincashSubscription = async (req, res) => {
  try {
    if (!requireUser(req, res)) return;

    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ message: "planCode مطلوب" });

    const plan = await Plan.findOne({ code: planCode, isActive: true });
    if (!plan) return res.status(404).json({ message: "الباقة غير موجودة" });

    const amount = Number(plan.priceIQD || 0);

    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({
        message: "المبلغ يجب أن يكون 1000 دينار أو أكثر",
      });
    }

    const orderId = `SUB_${req.user._id}_${Date.now()}`;

    await PaymentTransaction.create({
      user: req.user._id,
      kind: "subscription",
      plan: plan._id,
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

      const paymentUrl =
        `${ZC_REDIRECT_URL}?transactionId=${fakeTransactionId}&orderId=${orderId}`;

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
    console.error("initZaincashSubscription:", err?.response?.data || err);
    return res.status(500).json({
      message: "Failed to init subscription",
      error: err?.response?.data || err.message,
    });
  }
};


// =====================================================
// INIT WALLET TOPUP
// =====================================================
export const initZaincashTopup = async (req, res) => {
  try {
    if (!requireUser(req, res)) return;

    const amount = Number(req.body?.amountIQD || 0);

    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({
        message: "المبلغ يجب أن يكون 1000 دينار أو أكثر",
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

      const paymentUrl =
        `${ZC_REDIRECT_URL}?transactionId=${fakeTransactionId}&orderId=${orderId}`;

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
  try {
    const { transactionId, orderId } = req.query;

    const FRONTEND_SUCCESS_URL = process.env.FRONTEND_SUCCESS_URL || "/";
    const FRONTEND_FAIL_URL = process.env.FRONTEND_FAIL_URL || "/";
    const FRONTEND_WALLET_SUCCESS_URL = process.env.FRONTEND_WALLET_SUCCESS_URL || "/#/wallet?paid=1";
    const FRONTEND_WALLET_FAIL_URL = process.env.FRONTEND_WALLET_FAIL_URL || "/#/wallet?paid=0";

    if (!transactionId || !orderId) {
      return res.redirect(`${FRONTEND_FAIL_URL}&reason=missing_params`);
    }

    const tx = await PaymentTransaction.findOne({ orderId }).populate("plan").populate("user");

    if (!tx) {
      const failUrl = req.query.kind === 'wallet_topup' ? FRONTEND_WALLET_FAIL_URL : FRONTEND_FAIL_URL;
      return res.redirect(`${failUrl}&reason=tx_not_found`);
    }

    let isPaid = true;

    // ================= REAL MODE CHECK =================
    if (!isMock()) {
      const statusData = await getPaymentStatus(transactionId);

      await PaymentTransaction.updateOne(
        { orderId },
        { $set: { rawStatusResponse: statusData } }
      );

      const status = String(statusData.status || "").toLowerCase();

      isPaid =
        status === "completed" ||
        status === "success" ||
        status === "paid";
    }

    if (!isPaid) {
      await PaymentTransaction.updateOne(
        { orderId },
        { $set: { status: "failed" } }
      );

      const failUrl = tx.kind === 'wallet_topup' ? FRONTEND_WALLET_FAIL_URL : FRONTEND_FAIL_URL;
      return res.redirect(`${failUrl}&reason=not_paid`);
    }

    // ================= WALLET =================
    if (tx.kind === "wallet_topup") {
      await User.updateOne(
        { _id: tx.user },
        { $inc: { balance: tx.amountIQD } }
      );

      const receiptId = generateReceiptId();
      await PaymentTransaction.updateOne(
        { orderId },
        { $set: { status: "paid", receiptId } }
      );

      await FinanceLog.create({
        user: tx.user._id,
        type: "WALLET_TOPUP_PAID",
        amountIQD: tx.amountIQD,
        refModel: "PaymentTransaction",
        refId: tx._id,
        receiptId,
        meta: { orderId, provider: "zaincash", transactionId },
      });

      // ✅ Send Receipt Email
      sendReceiptEmail({
        to: tx.user.email,
        userName: tx.user.name,
        receiptId,
        amount: tx.amountIQD,
        type: "TOPUP",
        date: new Date(),
        details: `شحن محفظة عبر زين كاش (Order: ${orderId})`
      });

      // ✅ إشعار نجاح شحن المحفظة
      await sendAppNotification({
        userId: tx.user,
        title: "تم شحن المحفظة بنجاح 💰",
        message: `تم استلام مبلغ ${Number(tx.amountIQD).toLocaleString()} د.ع عبر زين كاش وإضافته لمتجرك.`,
        event: "WALLET_TOPUP_PAID",
        type: "SYSTEM",
      });

      return res.redirect(
        `${FRONTEND_WALLET_SUCCESS_URL}&topup=1&orderId=${encodeURIComponent(orderId)}`
      );
    }

    // ================= SUBSCRIPTION =================
    const now = new Date();
    const plan = tx.plan;

    const prevSub = await Subscription.findOne({ user: tx.user }).lean();
    const subWasExisting = !!prevSub;

    let sub = await Subscription.findOne({ user: tx.user });

    if (!sub) {
      sub = await Subscription.create({
        user: tx.user,
        plan: plan._id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: addOneMonth(now),
        auctionsUsedThisPeriod: 0,
      });
    } else {
      sub.plan = plan._id;
      sub.status = "active";
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = addOneMonth(now);
      sub.auctionsUsedThisPeriod = 0;
      await sub.save();
    }

    await User.updateOne(
      { _id: tx.user },
      { $set: { accountType: plan.audience } }
    );

    const receiptId = generateReceiptId();
    await PaymentTransaction.updateOne(
      { orderId },
      { $set: { status: "paid", receiptId } }
    );

    await FinanceLog.create({
      user: tx.user._id,
      type: subWasExisting
        ? "SUBSCRIPTION_UPGRADED"
        : "SUBSCRIPTION_ACTIVATED",
      amountIQD: tx.amountIQD,
      refModel: "PaymentTransaction",
      refId: tx._id,
      receiptId,
      meta: {
        orderId,
        planCode: plan.code,
        provider: "zaincash",
        transactionId,
      },
    });

    // ✅ Send Receipt Email
    sendReceiptEmail({
      to: tx.user.email,
      userName: tx.user.name,
      receiptId,
      amount: tx.amountIQD,
      type: "SUBSCRIPTION",
      date: new Date(),
      details: `${subWasExisting ? 'ترقية' : 'تفعيل'} باقة "${plan.name}" عبر زين كاش`
    });

    // ✅ إشعار نجاح الاشتراك/الترقية
    await sendAppNotification({
      userId: tx.user,
      title: subWasExisting ? "تمت ترقية اشتراكك! 🚀" : "تم تفعيل الاشتراك بنجاح! 🎉",
      message: `تم تفعيل باقة "${plan.name}" لحسابك بنجاح. استمتع بمميزات المنصة.`,
      event: subWasExisting ? "SUBSCRIPTION_UPGRADED" : "SUBSCRIPTION_ACTIVATED",
      type: "SYSTEM",
    });

    return res.redirect(
      `${FRONTEND_SUCCESS_URL}&orderId=${encodeURIComponent(orderId)}`
    );
  } catch (err) {
    console.error("zaincashRedirect:", err);
    const fail = process.env.FRONTEND_FAIL_URL || "/";
    return res.redirect(`${fail}&reason=exception`);
  }
};


// =====================================================
// STATUS CHECK
// =====================================================
export const zaincashStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const tx = await PaymentTransaction.findOne({
      orderId,
      user: req.user._id,
    }).populate("plan");

    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    return res.json({
      orderId: tx.orderId,
      transactionId: tx.transactionId,
      status: tx.status,
      plan: tx.plan?.code,
      amountIQD: tx.amountIQD,
      updatedAt: tx.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get status" });
  }
};