import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  let token;

  // ✅ التحقق الصحيح
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      req.user = await User.findById(decoded.id).select(
        "-password"
      );

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const isBanActive = req.user.banUntil && new Date(req.user.banUntil) > new Date();
      if (req.user.blocked || req.user.isBanned || isBanActive) {
        return res.status(403).json({
          message: "تم حظر الحساب بسبب مخالفات متكررة",
        });
      }

      next();
    } catch (error) {
      return res
        .status(401)
        .json({ message: "Invalid token" });
    }
  } else {
    return res
      .status(401)
      .json({ message: "No token provided" });
  }
};

export { protect };
