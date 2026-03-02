import { useEffect, useState } from "react";
import api from "../services/api";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type BalanceRequest = {
  _id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  user: {
    _id: string;
    name: string;
    phone: string;
    balance: number;
  };
};

const AdminBalanceRequests = () => {
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    const res = await api.get("/balance/requests");
    setRequests(res.data);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approve = async (id: string) => {
    setLoading(true);
    await api.post(`/balance/approve/${id}`);
    await fetchRequests();
    setLoading(false);
  };

  const reject = async (id: string) => {
    setLoading(true);
    await api.post(`/balance/reject/${id}`);
    await fetchRequests();
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <Link
          to="/admin/dashboard"
          style={{ padding: "8px", backgroundColor: "#f1f5f9", borderRadius: "8px", color: "#334155", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={20} />
        </Link>
        <h2 style={{ margin: 0 }}>طلبات تعبئة الرصيد</h2>
      </div>

      {requests.length === 0 && <p>لا توجد طلبات</p>}

      {requests.map((r) => (
        <div
          key={r._id}
          style={{
            border: "1px solid #ddd",
            padding: 15,
            marginBottom: 10,
          }}
        >
          <div>
            <strong>المستخدم:</strong> {r.user.name} – {r.user.phone}
          </div>

          <div>
            <strong>الرصيد الحالي:</strong> {r.user.balance} د.ع
          </div>

          <div>
            <strong>المبلغ المطلوب:</strong> {r.amount} د.ع
          </div>

          <div>
            <strong>الحالة:</strong>{" "}
            {r.status === "pending"
              ? "قيد المراجعة"
              : r.status === "approved"
                ? "مقبول"
                : "مرفوض"}
          </div>

          <small>{new Date(r.createdAt).toLocaleString()}</small>

          {r.status === "pending" && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => approve(r._id)}
                disabled={loading}
                style={{ marginRight: 10 }}
              >
                ✅ موافقة
              </button>

              <button
                onClick={() => reject(r._id)}
                disabled={loading}
              >
                ❌ رفض
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminBalanceRequests;
