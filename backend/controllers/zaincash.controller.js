import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import FinanceLog from "../models/FinanceLog.js";

import { createPayment, getPaymentStatus } from "../utils/zaincashV2.js";
import { v4 as uuidv4 } from "uuid";

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

const isMock = () => process.env.ZC_MOCK_MODE === "true";


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
        `${process.env.ZC_REDIRECT_URL}?transactionId=${fakeTransactionId}&orderId=${orderId}`;

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
      redirectUrl: process.env.ZC_REDIRECT_URL,
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
        `${process.env.ZC_REDIRECT_URL}?transactionId=${fakeTransactionId}&orderId=${orderId}`;

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
      redirectUrl: process.env.ZC_REDIRECT_URL,
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

    if (!transactionId || !orderId) {
      return res.redirect(`${FRONTEND_FAIL_URL}&reason=missing_params`);
    }

    const tx = await PaymentTransaction.findOne({ orderId }).populate("plan");

    if (!tx) {
      return res.redirect(`${FRONTEND_FAIL_URL}&reason=tx_not_found`);
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

      return res.redirect(`${FRONTEND_FAIL_URL}&reason=not_paid`);
    }

    // ================= WALLET =================
    if (tx.kind === "wallet_topup") {
      await User.updateOne(
        { _id: tx.user },
        { $inc: { balance: tx.amountIQD } }
      );

      await PaymentTransaction.updateOne(
        { orderId },
        { $set: { status: "paid" } }
      );

      await FinanceLog.create({
        user: tx.user,
        type: "WALLET_TOPUP_PAID",
        amountIQD: tx.amountIQD,
        refModel: "PaymentTransaction",
        refId: tx._id,
        meta: { orderId, provider: "zaincash", transactionId },
      });

      return res.redirect(
        `${FRONTEND_SUCCESS_URL}&topup=1&orderId=${encodeURIComponent(orderId)}`
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

    await PaymentTransaction.updateOne(
      { orderId },
      { $set: { status: "paid" } }
    );

    await FinanceLog.create({
      user: tx.user,
      type: subWasExisting
        ? "SUBSCRIPTION_UPGRADED"
        : "SUBSCRIPTION_ACTIVATED",
      amountIQD: tx.amountIQD,
      refModel: "PaymentTransaction",
      refId: tx._id,
      meta: {
        orderId,
        planCode: plan.code,
        provider: "zaincash",
        transactionId,
      },
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