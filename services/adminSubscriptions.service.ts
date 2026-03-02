import api from "../services/api";

export type SubscriptionRequest = {
  _id: string;
  status: "pending" | "approved" | "rejected";
  receiptImage: string;
  createdAt: string;

  user: {
    _id: string;
    name?: string;
    phone?: string;
  };

  plan: {
    code: string;
    name: string;
    priceIQD: number;
    audience: "user" | "trader";
  };
};

export async function fetchPendingRequests() {
  const { data } = await api.get<SubscriptionRequest[]>(
    "/admin/subscription-requests?status=pending"
  );
  return data;
}

export async function approveRequest(id: string) {
  const { data } = await api.post(
    `/admin/subscription-requests/${id}/approve`
  );
  return data;
}

export async function rejectRequest(id: string, note: string) {
  const { data } = await api.post(
    `/admin/subscription-requests/${id}/reject`,
    { note }
  );
  return data;
}
