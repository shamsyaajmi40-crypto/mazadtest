import User from "../models/User.js";
import Auction from "../models/Auction.js";

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
