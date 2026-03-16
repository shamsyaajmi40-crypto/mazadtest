import Auction from "../models/Auction.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import { uploadToR2 } from "../utils/r2.js";

// جلب ملف مستخدم + مزاداته
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email phone role blocked createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const auctions = await Auction.find({
      owner: user._id,
      isDeleted: false,
    }).populate("owner", "name").select("title status currentPrice endTime images");

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        blocked: user.blocked,
        createdAt: user.createdAt,
      },
      auctions,
    });

  } catch (err) {
    res.status(500).json({ message: "Failed to load user profile" });
  }
};
// GET /api/users/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -__v"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/users/me/profile
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, governorate, address, zainCashNumber, notificationPrefs, location } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: "رقم الهاتف مستخدم بالفعل" });
      }
      user.phone = phone;
    }

    if (name) user.name = name;
    if (governorate !== undefined) user.governorate = governorate;
    if (address !== undefined) user.address = address;
    if (zainCashNumber !== undefined) user.zainCashNumber = zainCashNumber;
    if (location !== undefined) user.location = location;

    if (notificationPrefs !== undefined) {
      user.notificationPrefs = {
        ...user.notificationPrefs,
        ...notificationPrefs
      };
    }

    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/users/me/favorites
export const toggleFavorite = async (req, res) => {
  try {
    const { auctionId } = req.body;
    if (!auctionId) return res.status(400).json({ message: "auctionId required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let isFavorite = false;
    const index = user.favorites.indexOf(auctionId);

    if (index === -1) {
      user.favorites.push(auctionId);
      isFavorite = true;
    } else {
      user.favorites.splice(index, 1);
      isFavorite = false;
    }

    await user.save();
    res.json({ message: "تم تحديث المفضلة", isFavorite, favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: "خطأ بالخادم" });
  }
};

// GET /api/users/me/favorites
export const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "favorites",
      match: { isDeleted: false },
      select: "title currentPrice images status endTime startingPrice"
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.favorites || []);
  } catch (err) {
    res.status(500).json({ message: "خطأ بالخادم" });
  }
};

// PUT /api/users/me/password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "خطأ بالخادم" });
  }
};

// POST /api/users/me/verify
export const submitVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.verification?.status === "verified") {
      return res.status(400).json({ message: "حسابك موثق بالفعل" });
    }

    if (user.verification?.status === "pending") {
      return res.status(400).json({ message: "طلب التوثيق قيد المراجعة حالياً" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "يرجى رفع صور الهوية المطلوبة" });
    }

    // الرفع لـ R2
    const uploadPromises = req.files.map((file) => uploadToR2(file));
    const imageUrls = await Promise.all(uploadPromises);

    user.verification = {
      status: "pending",
      images: imageUrls,
      submittedAt: new Date(),
    };

    await user.save();

    res.json({ message: "تم تقديم طلب التوثيق بنجاح، سيتم مراجعته قريباً", user });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "فشل تقديم طلب التوثيق" });
  }
};
