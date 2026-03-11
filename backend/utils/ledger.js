import crypto from "crypto";
import FinanceLog from "../models/FinanceLog.js";

export const ensureIntegerIQD = (value, fieldName = "amountIQD") => {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${fieldName} must be an integer IQD value`);
  }
  return num;
};

export const generateOperationId = (prefix = "op") => `${prefix}_${crypto.randomUUID()}`;

export const createLedgerEntry = async ({
  session = null,
  operationId = null,
  userId,
  type,
  amountIQD = 0,
  balanceBefore = 0,
  balanceAfter = 0,
  heldBefore = null,
  heldAfter = null,
  referenceModel = "",
  referenceId = null,
  receiptId = null,
  metadata = {},
}) => {
  if (!userId) throw new Error("Ledger entry requires userId");
  if (!type) throw new Error("Ledger entry requires type");

  const payload = {
    operationId: operationId || generateOperationId(type.toLowerCase()),
    user: userId,
    type,
    amountIQD: ensureIntegerIQD(amountIQD, "amountIQD"),
    balanceBefore: ensureIntegerIQD(balanceBefore, "balanceBefore"),
    balanceAfter: ensureIntegerIQD(balanceAfter, "balanceAfter"),
    heldBefore: heldBefore === null || heldBefore === undefined ? null : ensureIntegerIQD(heldBefore, "heldBefore"),
    heldAfter: heldAfter === null || heldAfter === undefined ? null : ensureIntegerIQD(heldAfter, "heldAfter"),
    refModel: referenceModel || "",
    refId: referenceId || null,
    receiptId: receiptId || null,
    meta: metadata || {},
  };

  const createOptions = session ? { session } : undefined;
  const [created] = await FinanceLog.create([payload], createOptions);
  return created;
};

