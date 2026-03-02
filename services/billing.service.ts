import api from "../services/api"; // أو المسار الصحيح حسب مشروعك (إذا api.ts داخل src)

export type PlanAudience = "user" | "trader";

export type Plan = {
  _id: string;
  code: string;
  audience: PlanAudience;
  name: string;
  priceIQD: number;
  monthlyAuctionLimit: number;
  isUnlimited: boolean;
  fairUseMonthlyLimit?: number;
};

export type Usage = { limit: number; used: number; remaining: number };

export type PendingRequest = {
  _id: string;
  status: "pending";
  receiptImage: string;
  plan?: { code: string; name: string; priceIQD: number; audience: PlanAudience };
};

export type MyBillingMe = {
  subscription: any | null;
  usage?: Usage;
  pendingRequest?: PendingRequest | null;
};

export async function fetchPlans(audience: PlanAudience) {
  const { data } = await api.get<Plan[]>(`/billing/plans?audience=${audience}`);
  return data;
}

export async function fetchMyBillingMe() {
  const { data } = await api.get<MyBillingMe>("/billing/me");
  return data;
}

export async function createUpgradeRequest(planCode: string, receiptFile: File) {
  const form = new FormData();
  form.append("planCode", planCode);
  form.append("receipt", receiptFile);

  const { data } = await api.post("/billing/upgrade-request", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}
