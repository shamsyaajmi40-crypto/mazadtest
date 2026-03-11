import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, try again later",
});

export const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Number(res.getHeader("Retry-After")) || 60;
    return res.status(429).json({
      message: "Too many bids, slow down",
      retryAfter,
    });
  },
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Number(res.getHeader("Retry-After")) || 600;
    return res.status(429).json({
      message: "Too many OTP attempts. Please try again later",
      retryAfter,
    });
  },
});
