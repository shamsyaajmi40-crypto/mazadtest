import "./config/env.js";
import dns from "dns";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import helmet from "helmet";
import mongoSanitize from "mongo-sanitize";
import cookieParser from "cookie-parser";
import { initIo } from "./utils/socket.js";
import { seedPlansIfEmpty } from "./utils/seedPlans.js";
import { startSubscriptionCron } from "./cron/subscription.cron.js";
import { activateScheduledAuctions } from "./cron/activateScheduledAuctions.js";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import closeAuctions from "./cron/auctionCloser.js";
import startAuctionCleanupCron from "./cron/auctionCleanup.js";

import authRoutes from "./routes/auth.routes.js";
import auctionRoutes from "./routes/auction.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import balanceRoutes from "./routes/balance.routes.js";
import userRoutes from "./routes/user.routes.js";
import ratingRoutes from "./routes/rating.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import courierRoutes from "./routes/courier.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("START FILE:", process.cwd(), __filename);
console.log("ZC loaded:", {
  msisdn: process.env.ZAINCASH_MSISDN ? "YES" : "NO",
  merchant: process.env.ZAINCASH_MERCHANT_ID ? "YES" : "NO",
});

dns.setDefaultResultOrder("ipv4first");

const app = express();
const httpServer = http.createServer(app);

// hardened socket.io configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://iqmazad.com",
  "https://www.iqmazad.com",
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: "*", // مؤقتاً للتشخيص - سنعيده للأصل بعد الحل
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ["websocket", "polling"], // السماح بكلا النوعين لضمان الاتصال
});

initIo(io);

// تأكد من وجود مجلد uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 uploads folder created");
}
// Socket.io Middleware للتحقق من التوكن (JWT)
io.use(async (socket, next) => {
  console.log(`🔍 [Socket Auth Attempt] ID: ${socket.id} | Origin: ${socket.handshake.headers.origin}`);
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.request.headers.cookie) {
      const cookies = socket.request.headers.cookie.split(';').reduce((acc, current) => {
        const [key, value] = current.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      console.warn(`❌ [Socket Auth] No token for socket ${socket.id}`);
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password").lean();

    if (!user) {
      console.warn(`❌ [Socket Auth] User not found for ID: ${decoded.id}`);
      return next(new Error("Authentication error: User not found"));
    }

    if (user.blocked || user.isBanned) {
      console.warn(`❌ [Socket Auth] User ${user._id} is blocked/banned`);
      return next(new Error("Authentication error: Unauthorized or Banned"));
    }

    socket.user = user;
    console.log(`✅ [Socket Auth Success] User: ${user._id}`);
    next();
  } catch (err) {
    console.error(`❌ [Socket Auth] Error:`, err.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  const count = io.engine.clientsCount;
  console.log(`🔌 [Connected] ID: ${socket.id} | User: ${socket.user?._id} | Total Active: ${count}`);

  socket.on("auction:join", (auctionId) => {
    socket.join(auctionId);
  });

  // الغرض هنا ربط كل مستخدم بغرفته الخاصة لتلقي الإشعارات اللحظية
  socket.on("user:join", (userId) => {
    // التأكد أن المستخدم ينضم لغرفته الخاصة فقط
    if (userId === String(socket.user._id)) {
      socket.join(userId);
    } else {
      console.warn(`⚠️ User ${socket.user._id} tried to join unauthorized room ${userId}`);
    }
  });
  // غرفة خاصة بالأدمن لتلقي التحديثات والإشعارات العامة
  socket.on("admin:join", () => {
    if (["admin", "superAdmin"].includes(socket.user.role)) {
      socket.join("admin_room");
    } else {
      console.warn(`⚠️ User ${socket.user._id} tried to join admin_room without permission`);
    }
  });

  socket.conn.on("close", (reason) => {
    console.log("Socket closed:", reason);
  });

  socket.on("disconnect", () => {
    const count = io.engine.clientsCount;
    console.log(`🔌 [Disconnected] ID: ${socket.id} | Total Active: ${count}`);
  });
});

/* ======================
   Middlewares
====================== */
app.use(helmet()); // حماية رؤوس HTTP
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://iqmazad.com",
    "https://www.iqmazad.com",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
// منع NoSQL Injection عبر مسح الكائنات من المدخلات
app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});
app.use("/uploads", express.static("uploads"));
app.use(express.urlencoded({ extended: true }));
/* ======================
   Routes
====================== */
app.use("/api/payments", paymentsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/balance", balanceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
console.log("✅ admin routes mounted at /api/admin");
app.use((req, _res, next) => {
  if (!req.url.includes("notification")) { // تقليل الزحام
    console.log(`📡 [HTTP] ${req.method} ${req.url}`);
  }
  next();
});
app.use("/api/notifications", notificationRoutes);
app.use("/api/courier", courierRoutes);
app.set("io", io);
app.set("trust proxy", 1);

/* ======================
   Global Error Handler
====================== */
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production"
    ? "Internal Server Error"
    : err.message;

  res.status(status).json({
    message,
    status: "error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Mazad API running" });
});
/* ======================
   Start Server (CORRECT)
====================== */
const PORT = process.env.PORT || 5000;
console.log("SERVER PID:", process.pid, "CWD:", process.cwd());
const startServer = async () => {
  try {
    console.log("MONGO_URI =", process.env.MONGO_URI);
    // ⬅️ انتظر الاتصال أولًا
    await connectDB();
    await seedPlansIfEmpty();
    // // ⬅️ Cron jobs
    closeAuctions();
    startSubscriptionCron();
    startAuctionCleanupCron();
    await activateScheduledAuctions();
    // كل 30 ثانية
    setInterval(async () => {
      try {
        await activateScheduledAuctions();
      } catch (err) {
        console.error("Activate scheduled auctions error:", err);
      }
    }, 30000);

    console.log("CRON INITIALIZED (Scheduled Auctions Activator)");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server + WebSocket running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};


startServer();
