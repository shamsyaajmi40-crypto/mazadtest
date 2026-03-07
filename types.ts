/* =======================
   Users
======================= */

export type UserRole = "user" | "admin" | "superAdmin";

export type User = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  governorate?: string;
  address?: string;
  role: UserRole;
  blocked?: boolean;
  createdAt?: string;
  heldBalance?: number;
  balance?: number;
  favorites?: string[];
};

/* =======================
   Auctions
======================= */
export const AUCTION_CATEGORIES = {
  CARS: "CARS",
  REAL_ESTATE: "REAL_ESTATE",
  ELECTRONICS: "ELECTRONICS",
  MOBILES: "MOBILES",
  OTHER: "OTHER",
} as const;
export type AuctionStatus =
  | "pending"
  | "active"
  | "upcoming"
  | "rejected"
  | "ended";
export const AUCTION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  UPCOMING: "upcoming",
  REJECTED: "rejected",
  ENDED: "ended",
} as const;

export type AuctionCategory =
  | "CARS"
  | "REAL_ESTATE"
  | "ELECTRONICS"
  | "MOBILES"
  | "OTHER";

export type Auction = {
  _id: string;

  title: string;
  description: string;


  category?: AuctionCategory;

  images: string[];

  startPrice: number;
  currentPrice: number;
  increment: number;
  deliveryMode?: "manual" | "courier";
  deliveryPenaltyReason?: string | null;
  deliveryOrder?: {
    status: string;
    failureReason?: string | null;
    deliveryFee?: number;
    company?: {
      _id?: string;
      name?: string;
      phone?: string;
      deliveryFee?: number;
    } | null;
  } | null;
  deliveryOtpCode?: string | null;
  payoutOtpCode?: string | null;
  endTime: string;
  status: AuctionStatus;
  owner:
  | string
  | {
    _id: string;
    name?: string;
  };
  // 👇 متوافق مع كل الصفحات
  seller: string | User;
  winner?: User | null;     // للصفحات القديمة
  winnerId?: string | null; // للباكند الحالي

  ratings?: {
    from: string;
    to: string;
    score: number;
    reasons?: string[];
    comment?: string;
    createdAt?: string;
  }[];

  createdAt?: string;
  updatedAt?: string;
};

/* =======================
   Bids
======================= */

export type Bid = {
  _id?: string;
  amount: number;
  bidder: string; // masked
  createdAt: string;
};

/* =======================
   Auth
======================= */

export type LoginPayload = {
  phone: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  phone: string;
  email: string;
  password: string;
  governorate?: string;
  address?: string;
};

/* =======================
   API Responses
======================= */

export type AuctionDetailsResponse = {
  auction: Auction;
  bids: Bid[];
};
