import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import { validatePhone, validateText } from "../utils/validation.js";

const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

export const register = async (req, res) => {
  try {
    const { name, phone, email, password, governorate, address } = req.body;

    // ✅ التحقق من صحة الاسم
    const nameVal = validateText(name, { min: 3, max: 50, name: "الاسم" });
    if (!nameVal.isValid) return res.status(400).json({ message: nameVal.message });

    // ✅ التحقق من صحة البريد الإلكتروني
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "يرجى إدخال بريد إلكتروني صحيح" });
    }

    // ✅ التحقق من صحة رقم الهاتف
    const phoneVal = validatePhone(phone);
    if (!phoneVal.isValid) return res.status(400).json({ message: phoneVal.message });

    const exists = await User.findOne({
      $or: [
        { phone: phoneVal.phone },
        { email: email.toLowerCase().trim() }
      ]
    });

    if (exists) {
      if (exists.phone === phoneVal.phone) {
        return res.status(400).json({ message: "هذا الرقم مسجل مسبقاً" });
      }
      return res.status(400).json({ message: "هذا البريد الإلكتروني مسجل مسبقاً" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: nameVal.text,
      phone: phoneVal.phone,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      governorate,
      address,
    });

    // ✅ إنشاء اشتراك افتراضي (USER_FREE) بعد التسجيل
    try {
      const freePlan = await Plan.findOne({ code: "USER_FREE", isActive: true }).select("_id");
      if (freePlan) {
        const now = new Date();
        await Subscription.create({
          user: user._id,
          plan: freePlan._id,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: addOneMonth(now),
          auctionsUsedThisPeriod: 0,
        });
      }
    } catch (e) {
      console.error("Create default subscription failed:", e);
      // لا نوقف التسجيل
    }

    const token = generateToken(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        governorate: user.governorate,
        address: user.address,
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "يرجى إدخال رقم الهاتف وكلمة المرور" });
    }

    const phoneVal = validatePhone(phone);
    if (!phoneVal.isValid) return res.status(400).json({ message: phoneVal.message });

    const user = await User.findOne({ phone: phoneVal.phone });
    if (!user) return res.status(401).json({ message: "البيانات المدخلة غير صحيحة" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        governorate: user.governorate,
        address: user.address,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req, res) => {
  res.json(req.user);
};

export const logout = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "تم تسجيل الخروج" });
};
