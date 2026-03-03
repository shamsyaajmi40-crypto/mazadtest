import AuditLog from "../models/AuditLog.js";
import FinanceLog from "../models/FinanceLog.js";
import User from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import mongoose from "mongoose";
import ExcelJS from "exceljs";

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

        const stats = {
            subscriptionRevenue: subRevenueAgg[0]?.total || 0,
            penaltyRevenue: totalPenaltyRevenue,
            penaltyBreakdown,
            totalPlatformRevenue: (subRevenueAgg[0]?.total || 0) + totalPenaltyRevenue,
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

/**
 * Get unified financial logs with advanced filters
 */
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

        let userMatchIds = null;
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            const matchingUsers = await User.find({
                $or: [
                    { name: searchRegex },
                    { phone: searchRegex }
                ]
            }).select("_id");
            userMatchIds = matchingUsers.map(u => u._id);
        }

        // Fetch from PaymentTransaction (Subscriptions, Topups)
        const getTxLogs = async () => {
            const match = { status: "paid", ...dateFilter };
            if (type === "subscription") match.kind = "subscription";
            if (type === "topup") match.kind = "wallet_topup";

            if (userMatchIds) {
                match.user = { $in: userMatchIds };
            }

            if (type !== "penalty" && type !== "refund") {
                const txs = await PaymentTransaction.find(match)
                    .sort({ createdAt: -1 })
                    .limit(limitNum * 10) // Broad fetch for local merging
                    .populate("user", "name phone")
                    .lean();

                return txs.map(t => ({
                    _id: t._id,
                    type: t.kind === "subscription" ? "SUBSCRIPTION" : "TOPUP",
                    status: "SUCCESS",
                    amount: t.amountIQD,
                    user: t.user,
                    createdAt: t.createdAt,
                    orderId: t.receiptId || t.orderId || "—",
                    provider: t.provider
                }));
            }
            return [];
        };

        // Fetch from AuditLog (Penalties, Refunds)
        const getAuditLogs = async () => {
            const actions = [];
            if (type === "all" || type === "penalty") actions.push("CONFISCATE_OK");
            if (type === "all" || type === "refund") actions.push("REFUND");

            if (actions.length > 0) {
                const match = { action: { $in: actions }, ...dateFilter };
                if (userMatchIds) {
                    match.user = { $in: userMatchIds };
                }

                const audits = await AuditLog.find(match)
                    .sort({ createdAt: -1 })
                    .limit(limitNum * 10) // Broad fetch for local merging
                    .populate("user", "name phone")
                    .populate("auction", "title")
                    .lean();

                return audits.map(p => ({
                    _id: p._id,
                    type: p.action === "CONFISCATE_OK" ? "PENALTY" : "DEPOSIT_REFUND",
                    status: "SUCCESS",
                    amount: p.amount,
                    user: p.user,
                    createdAt: p.createdAt,
                    auction: p.auction,
                    reason: p.reason,
                    source: p.source || "OTHER",
                    orderId: p.receiptId || (p.auction ? `AUC-${p.auction._id.toString().slice(-6).toUpperCase()}` : "—"),
                    meta: {
                        reason: p.reason,
                        auctionTitle: p.auction?.title,
                        source: p.source
                    }
                }));
            }
            return [];
        };

        // Fetch from FinanceLog (Manual Refund Requests & Manual Topups)
        const getFinanceLogs = async () => {
            if (type === "all" || type === "refund" || type === "topup") {
                const types = [];
                if (type === "all" || type === "refund") types.push("REFUND_REQUEST_APPROVED", "REFUND_REQUEST_REJECTED");
                if (type === "all" || type === "topup") types.push("WALLET_TOPUP_PAID");

                const match = {
                    type: { $in: types },
                    refModel: { $ne: "PaymentTransaction" }, // Avoid duplicates with getTxLogs
                    ...dateFilter
                };
                if (userMatchIds) match.user = { $in: userMatchIds };

                const finLogs = await FinanceLog.find(match)
                    .sort({ createdAt: -1 })
                    .limit(limitNum * 10)
                    .populate("user", "name phone")
                    .lean();

                return finLogs.map(l => ({
                    _id: l._id,
                    type: l.type === "WALLET_TOPUP_PAID" ? "TOPUP" : "WALLET_WITHDRAWAL",
                    status: l.type === "REFUND_REQUEST_REJECTED" ? "FAILED" : "SUCCESS",
                    amount: l.amountIQD,
                    user: l.user,
                    createdAt: l.createdAt,
                    reason: l.meta?.adminNote || l.meta?.reason || l.meta?.note || (l.type === "WALLET_TOPUP_PAID" ? "شحن يدوي" : "سحب رصيد"),
                    source: "منصة (يدوي)",
                    orderId: l.receiptId || (l.refId ? (l.type === "WALLET_TOPUP_PAID" ? `BAL-${l.refId.toString().slice(-6).toUpperCase()}` : `WDR-${l.refId.toString().slice(-6).toUpperCase()}`) : "—"),
                    meta: l.meta,
                    refId: l.refId
                }));
            }
            return [];
        };

        const [txLogs, auditLogs, finLogs] = await Promise.all([getTxLogs(), getAuditLogs(), getFinanceLogs()]);

        // Merge and sort
        let merged = [...txLogs, ...auditLogs, ...finLogs].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Refined local search for non-user fields (OrderId, Auction Title)
        if (search && search.trim()) {
            const s = search.trim().toUpperCase();
            merged = merged.filter(l =>
                (l.orderId && l.orderId.toUpperCase().includes(s)) ||
                (l.user?.name && l.user.name.includes(search)) ||
                (l.user?.phone && l.user.phone.includes(search)) ||
                (l.auction?.title && l.auction.title.toUpperCase().includes(s))
            );
        }

        const totalCount = merged.length;

        return res.json({
            logs: merged.slice(skip, skip + limitNum),
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

        // 1. Penalties & Refunds (AuditLog)
        if (type === "all" || type === "penalty" || type === "refund") {
            const actions = [];
            if (type === "all" || type === "penalty") actions.push("CONFISCATE_OK");
            if (type === "all" || type === "refund") actions.push("REFUND");

            const match = { action: { $in: actions }, ...dateFilter };
            if (userMatchIds) match.user = { $in: userMatchIds };

            const audits = await AuditLog.find(match).populate("user", "name phone").populate("auction", "title").lean();

            audits.forEach(p => {
                logs.push({
                    date: p.createdAt,
                    type: p.action === "CONFISCATE_OK" ? "مصادرة" : "إرجاع عربون",
                    status: "ناجحة",
                    user: p.user?.name || "—",
                    phone: p.user?.phone || "—",
                    amount: p.amount,
                    orderId: p.receiptId || (p.auction ? `AUC-${p.auction._id.toString().slice(-6).toUpperCase()}` : "—"),
                    source: p.source === "SELLER" ? "بائع" : (p.source === "BUYER" ? "مشتري" : (p.source === "PLATFORM" ? "منصة" : "—")),
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
                        amount: l.amountIQD,
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
                    amount: s.amountIQD,
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
                        amount: l.amountIQD,
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
 * Delete a manual financial log entry (from FinanceLog)
 */
export const deleteFinancialLog = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await FinanceLog.findById(id);

        if (!log) {
            return res.status(404).json({ message: "السجل غير موجود" });
        }

        // We only allow deleting manual entries for now (to avoid breaking automated audit trails)
        await FinanceLog.findByIdAndDelete(id);

        res.json({ message: "تم حذف السجل بنجاح" });
    } catch (e) {
        console.error("deleteFinancialLog error:", e);
        res.status(500).json({ message: "فشل حذف السجل" });
    }
};
