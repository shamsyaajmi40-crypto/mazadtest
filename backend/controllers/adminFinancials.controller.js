import AuditLog from "../models/AuditLog.js";
import FinanceLog from "../models/FinanceLog.js";
import User from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { createLedgerEntry, generateOperationId } from "../utils/ledger.js";

/**
 * Get unified financial stats for the platform
 */
export const getFinancialStats = async (req, res) => {
    try {
        const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID;
        let platformWalletBalance = 0;

        if (PLATFORM_USER_ID && mongoose.Types.ObjectId.isValid(PLATFORM_USER_ID)) {
            const platformUser = await User.findById(PLATFORM_USER_ID).select("balance");
            platformWalletBalance = platformUser?.balance || 0;
        }

        // 1. Subscription Revenue
        const subRevenueAgg = await PaymentTransaction.aggregate([
            { $match: { kind: "subscription", status: "paid" } },
            { $group: { _id: null, total: { $sum: "$amountIQD" }, count: { $sum: 1 } } }
        ]);

        // 2. Penalty Revenue (Confiscations) grouped by source
        const penaltyRevenueAgg = await AuditLog.aggregate([
            { $match: { action: "CONFISCATE_OK" } },
            {
                $group: {
                    _id: "$source",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalPenaltyRevenue = penaltyRevenueAgg.reduce((acc, curr) => acc + curr.total, 0);
        const penaltyBreakdown = penaltyRevenueAgg.reduce((acc, curr) => {
            acc[curr._id || "OTHER"] = { total: curr.total, count: curr.count };
            return acc;
        }, {});

        // 3. Cash Flow (Topups vs Payouts/Refunds recorded in PaymentTransaction)
        const cashFlowAgg = await PaymentTransaction.aggregate([
            { $match: { status: "paid" } },
            {
                $group: {
                    _id: "$kind",
                    total: { $sum: "$amountIQD" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 4. Commission Revenue
        const commissionRevenueAgg = await FinanceLog.aggregate([
            { $match: { type: "PLATFORM_COMMISSION" } },
            { $group: { _id: null, total: { $sum: "$amountIQD" }, count: { $sum: 1 } } }
        ]);
        const commissionRevenue = commissionRevenueAgg[0]?.total || 0;

        const stats = {
            subscriptionRevenue: subRevenueAgg[0]?.total || 0,
            commissionRevenue,
            penaltyRevenue: totalPenaltyRevenue,
            penaltyBreakdown,
            totalPlatformRevenue: (subRevenueAgg[0]?.total || 0) + totalPenaltyRevenue + commissionRevenue,
            platformWalletBalance,
            reconciliation: {
                auditTotalConfiscated: totalPenaltyRevenue,
                actualPlatformBalance: platformWalletBalance,
                isConsistent: platformWalletBalance === totalPenaltyRevenue,
                difference: platformWalletBalance - totalPenaltyRevenue
            },
            cashFlow: cashFlowAgg.reduce((acc, curr) => {
                acc[curr._id] = { total: curr.total, count: curr.count };
                return acc;
            }, {})
        };

        // 4. Monthly Distribution (Last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
        twelveMonthsAgo.setDate(1);

        const subMonthly = await PaymentTransaction.aggregate([
            {
                $match: {
                    kind: "subscription",
                    status: "paid",
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    total: { $sum: "$amountIQD" }
                }
            }
        ]);

        const penaltyMonthly = await AuditLog.aggregate([
            {
                $match: {
                    action: "CONFISCATE_OK",
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    total: { $sum: "$amount" }
                }
            }
        ]);

        // Merge monthly data for charts
        const chartData = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7); // YYYY-MM

            const sub = subMonthly.find(m => m._id === monthKey)?.total || 0;
            const penalty = penaltyMonthly.find(m => m._id === monthKey)?.total || 0;

            chartData.push({
                month: monthKey,
                subscriptions: sub,
                penalties: penalty,
                total: sub + penalty
            });
        }
        stats.monthlyChart = chartData.reverse();

        return res.json(stats);
    } catch (err) {
        console.error("getFinancialStats error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// GET /api/admin/financials/logs
export const getFinancialLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, type = "all", startDate, endDate, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        }

        // 1. Pre-fetch matching user IDs for search
        let userMatchIds = [];
        let searchActive = search && search.trim();
        if (searchActive) {
            const searchRegex = new RegExp(search.trim(), "i");
            const matchingUsers = await User.find({
                $or: [{ name: searchRegex }, { phone: searchRegex }]
            }).select("_id");
            userMatchIds = matchingUsers.map(u => u._id);
        }

        // 2. Build Pipeline
        const pipeline = [];

        // --- BASE: PaymentTransaction ---
        const ptMatch = { status: "paid", ...dateFilter };
        if (type === "subscription") ptMatch.kind = "subscription";
        else if (type === "topup") ptMatch.kind = "wallet_topup";
        else if (type !== "all") ptMatch._id = null; // Forces empty if type is penalty/refund but starting with PT

        pipeline.push({ $match: ptMatch });
        pipeline.push({
            $project: {
                _id: 1,
                type: { $cond: [{ $eq: ["$kind", "subscription"] }, "SUBSCRIPTION", "TOPUP"] },
                status: { $literal: "SUCCESS" }, // Static success for paid txs
                amount: "$amountIQD",
                user: 1,
                createdAt: 1,
                orderId: { $ifNull: ["$receiptId", { $ifNull: ["$orderId", "—"] }] },
                provider: 1,
                source: { $literal: "قناة دفع" }
            }
        });

        // --- UNION: AuditLog ---
        if (type === "all" || type === "penalty" || type === "refund") {
            const auditActions = [];
            if (type === "all" || type === "penalty") auditActions.push("CONFISCATE_OK");
            if (type === "all" || type === "refund") auditActions.push("REFUND");

            pipeline.push({
                $unionWith: {
                    coll: "auditlogs",
                    pipeline: [
                        { $match: { action: { $in: auditActions }, ...dateFilter } },
                        {
                            $lookup: {
                                from: "auctions",
                                localField: "auction",
                                foreignField: "_id",
                                as: "aucData"
                            }
                        },
                        { $unwind: { path: "$aucData", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                type: {
                                    $cond: [
                                        { $eq: ["$action", "CONFISCATE_OK"] }, "PENALTY",
                                        "DEPOSIT_REFUND"
                                    ]
                                },
                                status: { $literal: "SUCCESS" },
                                amount: "$amount",
                                user: 1,
                                createdAt: 1,
                                orderId: { $ifNull: ["$receiptId", { $cond: ["$aucData", { $concat: ["AUC-", { $substr: [{ $toString: "$aucData._id" }, 18, 6] }] }, "—"] }] },
                                reason: "$reason",
                                source: {
                                    $cond: [
                                        { $eq: ["$source", "SELLER"] }, "بائع",
                                        { $cond: [{ $eq: ["$source", "BUYER"] }, "مشتري", "عمولة منصة"] }
                                    ]
                                },
                                auctionTitle: "$aucData.title"
                            }
                        }
                    ]
                }
            });
        }

        // --- UNION: FinanceLog (Refund / Topup) ---
        if (type === "all" || type === "refund" || type === "topup") {
            const finTypes = [];
            if (type === "all" || type === "refund") finTypes.push("REFUND_REQUEST_APPROVED", "REFUND_REQUEST_REJECTED");
            if (type === "all" || type === "topup") finTypes.push("WALLET_TOPUP_PAID");

            pipeline.push({
                $unionWith: {
                    coll: "financelogs",
                    pipeline: [
                        {
                            $match: {
                                type: { $in: finTypes },
                                refModel: { $ne: "PaymentTransaction" },
                                ...dateFilter
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                type: { $cond: [{ $eq: ["$type", "WALLET_TOPUP_PAID"] }, "TOPUP", "WALLET_WITHDRAWAL"] },
                                status: { $cond: [{ $eq: ["$type", "REFUND_REQUEST_REJECTED"] }, "FAILED", "SUCCESS"] },
                                amount: "$amountIQD",
                                user: 1,
                                createdAt: 1,
                                orderId: { $ifNull: ["$receiptId", { $cond: ["$refId", { $concat: [{ $cond: [{ $eq: ["$type", "WALLET_TOPUP_PAID"] }, "BAL-", "WDR-"] }, { $substr: [{ $toString: "$refId" }, 18, 6] }] }, "—"] }] },
                                reason: { $ifNull: ["$meta.adminNote", { $ifNull: ["$meta.reason", { $ifNull: ["$meta.note", "—"] }] }] },
                                source: { $literal: "منصة (يدوي)" }
                            }
                        }
                    ]
                }
            });
        }

        // --- UNION: FinanceLog (Commission) ---
        if (type === "all" || type === "commission") {
            pipeline.push({
                $unionWith: {
                    coll: "financelogs",
                    pipeline: [
                        { $match: { type: "PLATFORM_COMMISSION", ...dateFilter } },
                        {
                            $lookup: {
                                from: "auctions",
                                localField: "refId",
                                foreignField: "_id",
                                as: "aucData"
                            }
                        },
                        { $unwind: { path: "$aucData", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                type: { $literal: "COMMISSION" },
                                status: { $literal: "SUCCESS" },
                                amount: "$amountIQD",
                                user: 1,
                                createdAt: 1,
                                orderId: { $ifNull: ["$receiptId", "—"] },
                                reason: { $ifNull: ["$meta.note", "عمولة منصة"] },
                                source: { $literal: "عمولة منصة" },
                                auctionTitle: "$aucData.title"
                            }
                        }
                    ]
                }
            });
        }

        if (searchActive) {
            const s = search.trim().toUpperCase();
            pipeline.push({
                $match: {
                    $or: [
                        { user: { $in: userMatchIds } },
                        { orderId: { $regex: s, $options: "i" } },
                        { auctionTitle: { $regex: s, $options: "i" } }
                    ]
                }
            });
        }

        pipeline.push({ $sort: { createdAt: -1 } });

        pipeline.push({
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limitNum },
                    {
                        $lookup: {
                            from: "users",
                            localField: "user",
                            foreignField: "_id",
                            as: "userData"
                        }
                    },
                    { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            "user": {
                                _id: "$userData._id",
                                name: "$userData.name",
                                phone: "$userData.phone"
                            }
                        }
                    },
                    { $project: { userData: 0 } }
                ],
                total: [{ $count: "count" }]
            }
        });

        const [result] = await PaymentTransaction.aggregate(pipeline);
        const logs = result.data || [];
        const totalCount = result.total[0]?.count || 0;

        return res.json({
            logs,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                pages: Math.ceil(totalCount / limitNum)
            }
        });

    } catch (err) {
        console.error("getFinancialLogs error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};


/**
 * Export financial logs to Excel with advanced filters
 */
export const exportFinancialsExcel = async (req, res) => {
    try {
        const { type = "all", period = "month", startDate, endDate, search } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        } else {
            let start = new Date();
            if (period === "week") start.setDate(start.getDate() - 7);
            else start.setMonth(start.getMonth() - 1);
            dateFilter.createdAt = { $gte: start };
        }

        let userMatchIds = null;
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            const matchingUsers = await User.find({
                $or: [{ name: searchRegex }, { phone: searchRegex }]
            }).select("_id");
            userMatchIds = matchingUsers.map(u => u._id);
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Financial Report");

        sheet.columns = [
            { header: "التاريخ", key: "date", width: 22 },
            { header: "النوع", key: "type", width: 15 },
            { header: "الحالة", key: "status", width: 10 },
            { header: "المستخدم", key: "user", width: 20 },
            { header: "رقم الهاتف", key: "phone", width: 15 },
            { header: "المبلغ (IQD)", key: "amount", width: 15 },
            { header: "رقم الطلب / المرجع", key: "orderId", width: 20 },
            { header: "المصدر", key: "source", width: 15 },
            { header: "التفاصيل / السبب", key: "details", width: 40 },
        ];

        let logs = [];

        // 1. Penalties & Refunds & Commissions (AuditLog)
        if (type === "all" || type === "penalty" || type === "refund" || type === "commission") {
            const actions = [];
            if (type === "all" || type === "penalty") actions.push("CONFISCATE_OK");
            if (type === "all" || type === "refund") actions.push("REFUND");
            if (type === "all" || type === "commission") actions.push("PLATFORM_COMMISSION");

            const match = { action: { $in: actions }, ...dateFilter };
            if (userMatchIds) match.user = { $in: userMatchIds };

            const audits = await AuditLog.find(match).populate("user", "name phone").populate("auction", "title").lean();

            audits.forEach(p => {
                logs.push({
                    date: p.createdAt,
                    type: p.action === "CONFISCATE_OK" ? "مصادرة" : (p.action === "REFUND" ? "إرجاع عربون" : "عمولة مزاد"),
                    status: "ناجحة",
                    user: p.user?.name || "—",
                    phone: p.user?.phone || "—",
                    amount: Number(p.amountIQD || p.amount || 0),
                    orderId: p.receiptId || (p.auction ? `AUC-${p.auction._id.toString().slice(-6).toUpperCase()}` : "—"),
                    source: p.source === "SELLER" ? "بائع" : (p.source === "BUYER" ? "مشتري" : "عمولة منصة"),
                    details: p.reason + (p.auction ? ` (مزاد: ${p.auction.title})` : "")
                });
            });

            // 1.1 Manual Refunds (FinanceLog)
            if (type === "all" || type === "refund") {
                const fMatch = {
                    type: { $in: ["REFUND_REQUEST_APPROVED", "REFUND_REQUEST_REJECTED"] },
                    ...dateFilter
                };
                if (userMatchIds) fMatch.user = { $in: userMatchIds };

                const fLogs = await FinanceLog.find(fMatch).populate("user", "name phone").lean();
                fLogs.forEach(l => {
                    logs.push({
                        date: l.createdAt,
                        type: "سحب رصيد",
                        status: l.type === "REFUND_REQUEST_APPROVED" ? "ناجحة" : "فاشلة",
                        user: l.user?.name || "—",
                        phone: l.user?.phone || "—",
                        amount: Number(l.amountIQD || l.amount || 0),
                        orderId: l.receiptId || (l.refId ? `WDR-${l.refId.toString().slice(-6).toUpperCase()}` : "—"),
                        source: "منصة (يدوي)",
                        details: (l.type === "REFUND_REQUEST_APPROVED" ? "موافقة" : "رفض") + ": " + (l.meta?.adminNote || l.meta?.reason || "—")
                    });
                });
            }
        }

        // 2. Subscriptions & Topups
        if (type === "all" || type === "subscription" || type === "topup") {
            const match = { status: "paid", ...dateFilter };
            if (type === "subscription") match.kind = "subscription";
            if (type === "topup") match.kind = "wallet_topup";
            if (userMatchIds) match.user = { $in: userMatchIds };

            const txs = await PaymentTransaction.find(match).populate("user", "name phone").lean();

            txs.forEach(s => {
                logs.push({
                    date: s.createdAt,
                    type: s.kind === "subscription" ? "اشتراك" : "شحن رصيد",
                    status: "ناجحة",
                    user: s.user?.name || "—",
                    phone: s.user?.phone || "—",
                    amount: Number(s.amountIQD || s.amount || 0),
                    orderId: s.receiptId || s.orderId || "—",
                    source: "منصة",
                    details: s.kind === "subscription" ? "اشتراك باقة" : "إيداع محفظة"
                });
            });

            // 2.1 Manual Topups (FinanceLog)
            if (type === "all" || type === "topup") {
                const ftMatch = {
                    type: "WALLET_TOPUP_PAID",
                    refModel: { $ne: "PaymentTransaction" },
                    ...dateFilter
                };
                if (userMatchIds) ftMatch.user = { $in: userMatchIds };
                const ftLogs = await FinanceLog.find(ftMatch).populate("user", "name phone").lean();
                ftLogs.forEach(l => {
                    logs.push({
                        date: l.createdAt,
                        type: "شحن رصيد",
                        status: "ناجحة",
                        user: l.user?.name || "—",
                        phone: l.user?.phone || "—",
                        amount: Number(l.amountIQD || l.amount || 0),
                        orderId: l.receiptId || (l.refId ? `BAL-${l.refId.toString().slice(-6).toUpperCase()}` : "—"),
                        source: "منصة (يدوي)",
                        details: l.meta?.note || "شحن يدوي"
                    });
                });
            }
        }

        // Search in local identifiers if search active
        if (search && search.trim()) {
            const s = search.trim().toUpperCase();
            logs = logs.filter(l =>
                l.orderId.toUpperCase().includes(s) ||
                l.user.includes(search) ||
                l.phone.includes(search) ||
                l.details.toUpperCase().includes(s)
            );
        }

        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        logs.forEach(l => {
            sheet.addRow({
                date: new Date(l.date).toLocaleString("ar-IQ"),
                type: l.type,
                status: l.status,
                user: l.user,
                phone: l.phone,
                amount: l.amount,
                orderId: l.orderId,
                source: l.source,
                details: l.details
            });
        });

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=financial-report.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("exportFinancialsExcel error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Immutable ledger policy:
 * This endpoint no longer deletes financial logs.
 * It posts a compensating reversal entry instead.
 */
export const deleteFinancialLog = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const log = await FinanceLog.findById(id).session(session);

        if (!log) {
            await session.abortTransaction();
            return res.status(404).json({ message: "'D3,D :J1 EH,H/" });
        }

        if (log.type === "LEDGER_REVERSAL") {
            await session.abortTransaction();
            return res.status(400).json({ message: "D' JECF 9C3 BJ/ 9C3J" });
        }

        const alreadyReversed = await FinanceLog.findOne({
            type: "LEDGER_REVERSAL",
            refModel: "FinanceLog",
            refId: log._id,
        }).session(session);

        if (alreadyReversed) {
            await session.abortTransaction();
            return res.status(409).json({ message: "*E 9C3 G0' 'D3,D E3(BK'" });
        }

        const user = await User.findById(log.user).select("balance heldBalance").session(session);
        if (!user) {
            throw new Error("Ledger owner wallet not found");
        }

        const currentBalance = Number(user.balance || 0);
        const currentHeld = Number(user.heldBalance || 0);
        const balanceDelta = Number(log.balanceAfter || 0) - Number(log.balanceBefore || 0);
        const heldDelta = Number(log.heldAfter || 0) - Number(log.heldBefore || 0);
        const reverseBalanceDelta = -balanceDelta;
        const reverseHeldDelta = -heldDelta;

        const nextBalance = currentBalance + reverseBalanceDelta;
        const nextHeld = currentHeld + reverseHeldDelta;
        if (nextBalance < 0 || nextHeld < 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "D' JECF *FAJ0 'DBJ/ 'D9C3J D#FG 3J$/J %DI 15J/ 3'D(" });
        }

        const walletUpdated = await User.updateOne(
            { _id: user._id, balance: currentBalance, heldBalance: currentHeld },
            { $set: { balance: nextBalance, heldBalance: nextHeld } },
            { session }
        );

        if (walletUpdated.modifiedCount === 0) {
            throw new Error("Wallet update conflict while reversing ledger entry");
        }

        const reversalAmount = -Number(log.amountIQD || 0);
        const reversalOperationId = generateOperationId("ledger_reversal");

        await createLedgerEntry({
            session,
            operationId: reversalOperationId,
            userId: user._id,
            type: "LEDGER_REVERSAL",
            amountIQD: reversalAmount,
            balanceBefore: currentBalance,
            balanceAfter: nextBalance,
            heldBefore: currentHeld,
            heldAfter: nextHeld,
            referenceModel: "FinanceLog",
            referenceId: log._id,
            receiptId: generateReceiptId(),
            metadata: {
                reversedOperationId: log.operationId || null,
                reversedLogId: String(log._id),
                originalType: log.type,
                reason: "Admin reversal instead of delete",
                adminId: String(req.user?._id || ""),
            },
        });

        await session.commitTransaction();
        return res.json({
            message: "*E %F4'! BJ/ 9C3J (F,'- ('D3,D 'D#5DJ DE JO-0A)",
            reversedLogId: String(log._id),
            reversalOperationId,
        });
    } catch (e) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("deleteFinancialLog error:", e);
        return res.status(500).json({ message: "A4D %F4'! 'DBJ/ 'D9C3J" });
    } finally {
        session.endSession();
    }
};

/**
 * GET /admin/financials/featured-payments
 * جلب سجلات التمييز المدفوع مع إجمالي الإيراد
 */
export const getFeaturedPayments = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
        const skip = (page - 1) * limit;
        const { startDate, endDate, search } = req.query;

        const match = { type: "FEATURE_AUCTION_PAYMENT" };

        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                match.createdAt.$lte = end;
            }
        }

        // Aggregate stats (total revenue + count)
        const [statsAgg] = await FinanceLog.aggregate([
            { $match: { type: "FEATURE_AUCTION_PAYMENT" } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amountIQD" },
                    totalCount: { $sum: 1 },
                }
            }
        ]);

        // Fetch logs with user + auction populated
        let query = FinanceLog.find(match)
            .populate("user", "name phone")
            .populate({ path: "refId", model: "Auction", select: "title _id" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const [logs, total] = await Promise.all([
            query.lean(),
            FinanceLog.countDocuments(match),
        ]);

        // Apply in-memory search filter on user name/phone if provided
        let filtered = logs;
        if (search) {
            const s = search.toLowerCase();
            filtered = logs.filter(l =>
                l.user?.name?.toLowerCase().includes(s) ||
                l.user?.phone?.includes(s)
            );
        }

        res.json({
            logs: filtered,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total,
            },
            stats: {
                totalRevenue: statsAgg?.totalRevenue || 0,
                totalCount: statsAgg?.totalCount || 0,
            }
        });
    } catch (e) {
        console.error("getFeaturedPayments error:", e);
        res.status(500).json({ message: "فشل في جلب سجلات التمييز" });
    }
};

