// controllers/adminAuctionArchive.controller.js
import Auction from "../models/Auction.js";
import AuditLog from "../models/AuditLog.js";

export const getAdminAuctionArchive = async (req, res) => {
  try {
    const {
      status,          // success | failed | no_winner
      deliveryMode,    // manual | courier
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.min(Number(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    // 🧩 base filter
    const filter = {
      isDeleted: false,
    };

    // 🔹 result filter
    if (status === "success") {
      filter.status = "completed";
    } else if (status === "failed") {
      filter.status = {
        $in: [
          "cancelled_by_winner",
          "cancelled_by_seller",
          "cancelled_by_both",
          "rejected",
          "failed" // fallback historical
        ],
      };
    } else if (status === "no_winner") {
      filter.status = "ENDED";
      filter.winner = null;
    } else {
      // Default: show all archived statuses (not active, not pending, not upcoming)
      filter.status = {
        $in: [
          "completed",
          "cancelled_by_winner",
          "cancelled_by_seller",
          "cancelled_by_both",
          "rejected",
          "ENDED",
          "failed"
        ],
      };
    }

    // 🔹 delivery mode
    if (deliveryMode) {
      filter.deliveryMode = deliveryMode;
    }

    // 🔹 date range
    if (from || to) {
      filter.updatedAt = {};
      if (from) filter.updatedAt.$gte = new Date(from);
      if (to) filter.updatedAt.$lte = new Date(to);
    }

    // 🔍 fetch auctions
    const [auctions, total] = await Promise.all([
      Auction.find(filter)
        .populate("seller", "name")
        .populate("winner", "name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Auction.countDocuments(filter),
    ]);

    // 🧠 attach audit insights
    const auctionIds = auctions.map((a) => a._id);

    const logs = await AuditLog.find({
      auction: { $in: auctionIds },
    }).lean();

    const logsByAuction = {};
    for (const log of logs) {
      const id = String(log.auction);
      if (!logsByAuction[id]) logsByAuction[id] = [];
      logsByAuction[id].push(log);
    }

    const enriched = auctions.map((auction) => {
      const auctionLogs = logsByAuction[String(auction._id)] || [];

      const hasPenalty = auctionLogs.some(
        (l) => l.action === "CONFISCATE_OK"
      );

      const platformEarned = auctionLogs
        .filter((l) => l.action === "CONFISCATE_OK")
        .reduce((sum, l) => sum + (l.amount || 0), 0);

      let result = "unknown";
      if (auction.status === "completed") result = "success";
      else if (
        [
          "cancelled_by_winner",
          "cancelled_by_seller",
          "cancelled_by_both",
          "rejected",
          "failed"
        ].includes(auction.status)
      )
        result = "failed";
      else if (auction.status === "ENDED" && (!auction.winner || String(auction.winner) === ""))
        result = "no_winner";

      return {
        ...auction,
        result,
        hasPenalty,
        platformEarned,
      };
    });

    res.json({
      auctions: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Admin auction archive error:", err);
    res.status(500).json({ message: "Failed to load auction archive" });
  }
};
