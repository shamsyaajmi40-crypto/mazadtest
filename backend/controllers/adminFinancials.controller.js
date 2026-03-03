import PaymentTransaction from "../models/PaymentTransaction.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
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
 * Get unified financial logs
 */
export const getFinancialLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, type = "all" } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let logs = [];
        let totalCount = 0;

        if (type === "all" || type === "subscription" || type === "topup") {
            const match = { status: "paid" };
            if (type === "subscription") match.kind = "subscription";
            if (type === "topup") match.kind = "wallet_topup";

            const txs = await PaymentTransaction.find(match)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .populate("user", "name phone")
                .lean();

            logs = txs.map(t => ({
                _id: t._id,
                type: t.kind === "subscription" ? "SUBSCRIPTION" : "TOPUP",
                amount: t.amountIQD,
                user: t.user,
                createdAt: t.createdAt,
                orderId: t.orderId,
                provider: t.provider
            }));

            totalCount = await PaymentTransaction.countDocuments(match);
        } else if (type === "penalty") {
            const match = { action: "CONFISCATE_OK" };
            const penalties = await AuditLog.find(match)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .populate("user", "name phone")
                .populate("auction", "title")
                .lean();

            logs = penalties.map(p => ({
                _id: p._id,
                type: "PENALTY",
                amount: p.amount,
                user: p.user,
                createdAt: p.createdAt,
                auction: p.auction,
                reason: p.reason,
                source: p.source || "OTHER"
            }));

            totalCount = await AuditLog.countDocuments(match);
        }

        return res.json({
            logs,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error("getFinancialLogs error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Export financial logs to Excel
 */
export const exportFinancialsExcel = async (req, res) => {
    try {
        const { type = "all", period = "month" } = req.query;

        let startDate = new Date();
        if (period === "week") {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate.setMonth(startDate.getMonth() - 1);
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Financial Report");

        sheet.columns = [
            { header: "التاريخ", key: "date", width: 22 },
            { header: "النوع", key: "type", width: 15 },
            { header: "المستخدم", key: "user", width: 20 },
            { header: "رقم الهاتف", key: "phone", width: 15 },
            { header: "المبلغ (IQD)", key: "amount", width: 15 },
            { header: "المصدر", key: "source", width: 15 },
            { header: "التفاصيل / السبب", key: "details", width: 40 },
        ];

        // Fetch Data
        let logs = [];

        // 1. Penalties
        if (type === "all" || type === "penalty") {
            const penalties = await AuditLog.find({
                action: "CONFISCATE_OK",
                createdAt: { $gte: startDate }
            }).populate("user", "name phone").populate("auction", "title").lean();

            penalties.forEach(p => {
                logs.push({
                    date: p.createdAt,
                    type: "مصادرة",
                    user: p.user?.name || "—",
                    phone: p.user?.phone || "—",
                    amount: p.amount,
                    source: p.source === "SELLER" ? "بائع" : (p.source === "BUYER" ? "مشتري" : "—"),
                    details: p.reason + (p.auction ? ` (مزاد: ${p.auction.title})` : "")
                });
            });
        }

        // 2. Subscriptions
        if (type === "all" || type === "subscription") {
            const subs = await PaymentTransaction.find({
                kind: "subscription",
                status: "paid",
                createdAt: { $gte: startDate }
            }).populate("user", "name phone").lean();

            subs.forEach(s => {
                logs.push({
                    date: s.createdAt,
                    type: "اشتراك",
                    user: s.user?.name || "—",
                    phone: s.user?.phone || "—",
                    amount: s.amountIQD,
                    source: "منصة",
                    details: `اشتراك رقم طلب: ${s.orderId || "—"}`
                });
            });
        }

        // Sort by date desc
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Add to sheet
        logs.forEach(l => {
            sheet.addRow({
                date: new Date(l.date).toLocaleString("ar-IQ"),
                type: l.type,
                user: l.user,
                phone: l.phone,
                amount: l.amount,
                source: l.source,
                details: l.details
            });
        });

        // Styling
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=financial-report-${period}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("exportFinancialsExcel error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
