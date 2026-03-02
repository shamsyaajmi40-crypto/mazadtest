import { useEffect, useState, useContext, useMemo } from "react";
import api from "../services/api";
import { Auction } from "../types";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/* ================= Utils ================= */

const getResultLabel = (auction: any) => {
  switch (auction.result) {
    case "success":
      return { text: "ناجح", className: "text-green-700" };

    case "failed":
      if (auction.status === "cancelled_by_winner")
        return { text: "فشل (المشتري)", className: "text-red-700" };

      if (auction.status === "cancelled_by_seller")
        return { text: "فشل (البائع)", className: "text-red-700" };

      if (auction.status === "cancelled_by_both")
        return { text: "فشل (الطرفين)", className: "text-red-700" };

      if (auction.status === "rejected")
        return { text: "مرفوض", className: "text-gray-600" };

      return { text: "فشل", className: "text-red-700" };

    case "no_winner":
      return { text: "انتهى بدون فائز", className: "text-gray-600" };

    default:
      return { text: "غير معروف", className: "text-yellow-600" };
  }
};

/* ================= Component ================= */

const AdminCompletedAuctions = () => {
  const { user } = useContext(AuthContext);

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /* ===== Filters ===== */
  const [statusFilter, setStatusFilter] = useState<
    "" | "success" | "failed" | "no_winner"
  >("");
  const [deliveryFilter, setDeliveryFilter] = useState<
    "" | "manual" | "courier"
  >("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ================= Excel ================= */

  const downloadExcel = async () => {
    try {
      const query = new URLSearchParams();

      if (statusFilter) query.append("status", statusFilter);
      if (deliveryFilter) query.append("deliveryMode", deliveryFilter);
      if (fromDate) query.append("from", fromDate);
      if (toDate) query.append("to", toDate);

      const res = await api.get(`/admin/auctions/export?${query.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mazad-archive.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel download failed", err);
      alert("فشل تحميل ملف Excel");
    }
  };

  /* ================= Fetch ================= */

  useEffect(() => {
    let mounted = true;

    const fetchAuctions = async () => {
      try {
        setLoading(true);

        const query = new URLSearchParams({
          page: String(page),
          limit: "10",
        });

        if (statusFilter) query.append("status", statusFilter);
        if (deliveryFilter) query.append("deliveryMode", deliveryFilter);
        if (fromDate) query.append("from", fromDate);
        if (toDate) query.append("to", toDate);

        const res = await api.get(
          `/admin/auctions/archive?${query.toString()}`
        );

        if (!mounted) return;

        setAuctions(res.data.auctions || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      } catch (err) {
        console.error("Failed to load admin archive", err);
      } finally {
        mounted && setLoading(false);
      }
    };

    fetchAuctions();

    return () => {
      mounted = false;
    };
  }, [page, statusFilter, deliveryFilter, fromDate, toDate]);

  /* reset page on filter change */
  useEffect(() => {
    setPage(1);
  }, [statusFilter, deliveryFilter, fromDate, toDate]);

  /* ================= Performance (SAFE) ================= */
  // لا نغير المنطق، فقط نمنع إعادة بناء الجدول بلا داعٍ
  const visibleAuctions = useMemo(() => auctions, [auctions]);

  /* ================= Render ================= */

  if (loading) {
    return <div className="page-loading">جاري تحميل أرشيف المزادات...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/dashboard"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            title="الرجوع للوحة التحكم"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">أرشيف المزادات (الإدارة)</h1>
        </div>

        {user?.role === "superAdmin" && (
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-lg font-bold shadow-sm"
          >
            <span>⬇️</span>
            <span>تحميل الأرشيف (Excel)</span>
          </button>
        )}
      </div>

      {/* ================= Filters ================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">النتيجة</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          >
            <option value="">الكل</option>
            <option value="success">ناجحة</option>
            <option value="failed">فاشلة</option>
            <option value="no_winner">بدون فائز</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">التوصيل</label>
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value as any)}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          >
            <option value="">الكل</option>
            <option value="manual">بدون شركة</option>
            <option value="courier">شركة توصيل</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">من</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">إلى</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          />
        </div>
      </div>

      {/* ================= Table ================= */}

      {visibleAuctions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-500 font-medium">لا توجد مزادات مؤرشفة ضمن هذا الفلتر.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">المزاد</th>
                  <th className="px-4 py-3 whitespace-nowrap">البائع</th>
                  <th className="px-4 py-3 whitespace-nowrap">الفائز</th>
                  <th className="px-4 py-3 whitespace-nowrap">السعر</th>
                  <th className="px-4 py-3 whitespace-nowrap">النتيجة</th>
                  <th className="px-4 py-3 whitespace-nowrap">التاريخ</th>
                  <th className="px-4 py-3 whitespace-nowrap">عقوبة</th>
                </tr>
              </thead>

              <tbody>
                {visibleAuctions.map((auction: any) => {
                  const result = getResultLabel(auction);

                  return (
                    <tr
                      key={auction._id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                        {auction.title.length > 20 ? auction.title.slice(0, 20) + "..." : auction.title}
                      </td>

                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {typeof auction.seller === "string"
                          ? "—"
                          : auction.seller?.name}
                      </td>

                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {auction.winner && typeof auction.winner !== "string" ? (
                          auction.winner.name
                        ) : auction.status?.startsWith("cancelled") || auction.status === "failed" ? (
                          <span className="text-red-600 font-semibold">
                            أُلغي
                          </span>
                        ) : auction.status === "rejected" ? (
                          <span className="text-gray-600 font-semibold">
                            مرفوض
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {auction.currentPrice?.toLocaleString()} د.ع
                      </td>

                      <td className={`px-4 py-3 font-bold whitespace-nowrap ${result.className}`}>
                        {result.text}
                        {auction.hasPenalty && (
                          <div className="text-xs text-red-600 mt-1">
                            💰 دخل للمنصة
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(auction.updatedAt).toLocaleDateString("ar-IQ", { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {auction.hasPenalty ? <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded">مفروضة</span> : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
              >
                السابق
              </button>

              <div className="text-sm text-slate-500 font-medium">
                صفحة <span className="text-slate-800 font-bold">{page}</span> من <span className="text-slate-800 font-bold">{totalPages}</span>
              </div>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCompletedAuctions;
