import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, try again later",
});

export const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true, // يضيف RateLimit-* headers
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Number(res.getHeader("Retry-After")) || 60; // ثواني
    return res.status(429).json({
      message: "Too many bids, slow down",
      retryAfter, // ✅ هذا الذي سنستخدمه لعداد الفرونت
    });
  },
});