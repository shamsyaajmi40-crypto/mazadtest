import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Search, RefreshCw, CheckCircle, XCircle, CreditCard, Activity, Calendar, FileText, User, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const money = (n: any) => `${Number(n || 0).toLocaleString("en-US")} د.ع`;
const metaSummary = (meta: any) => {
  if (!meta) return "—";
  const parts: string[] = [];
  if (meta.payoutInfo) parts.push(`بيانات التحويل: ${String(meta.payoutInfo)}`);
  if (meta.note) parts.push(`ملاحظة: ${String(meta.note)}`);
  if (meta.reason) parts.push(`السبب: ${String(meta.reason)}`);
  if (meta.adminName || meta.adminPhone) {
    const n = meta.adminName ? String(meta.adminName) : "—";
    const p = meta.adminPhone ? String(meta.adminPhone) : "";
    parts.push(`الأدمن: ${n}${p ? " (" + p + ")" : ""}`);
  } else if (meta.adminId) {
    parts.push(`adminId: ${String(meta.adminId)}`);
  }
  if (meta.adminId && !meta.adminName && !meta.adminPhone) parts.push(`adminId: ${String(meta.adminId)}`);

  return parts.length ? parts.join(" | ") : "—";
};

type RefundReq = {
  _id: string;
  amountIQD: number;
  payoutInfo: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
  user?: {
    name?: string;
    phone?: string;
    balance?: number;
    heldBalance?: number;
  };
};

type RefundLog = {
  _id: string;
  action: string;
  amount?: number;
  meta?: any;
  createdAt: string;
  user?: { name?: string; phone?: string };
  refId?: string;
};

const statusLabel = (s: string) => {
  switch (s) {
    case "pending": return <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-black border border-amber-200">قيد المراجعة</span>;
    case "approved": return <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-xs font-black border border-emerald-200">تمت الموافقة</span>;
    case "rejected": return <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md text-xs font-black border border-rose-200">مرفوض</span>;
    default: return <span>{s}</span>;
  }
};

const actionLabel = (a: string) => {
  if (a === "REFUND_REQUEST_CREATED") return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit text-xs font-bold border border-blue-100">إنشاء طلب استرجاع</span>;
  if (a === "REFUND_REQUEST_APPROVED") return <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit text-xs font-bold border border-emerald-100">موافقة على الاسترجاع</span>;
  if (a === "REFUND_REQUEST_REJECTED") return <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded w-fit text-xs font-bold border border-rose-100">رفض الاسترجاع</span>;
  return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded w-fit text-xs font-bold border border-slate-200">{a}</span>;
};

export default function AdminRefundRequests() {
  const [tab, setTab] = useState<"requests" | "logs">("requests");

  const [items, setItems] = useState<RefundReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});

  // Logs
  const [logs, setLogs] = useState<RefundLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr, setLogsErr] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/admin/refund-requests");
      setItems(res.data || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "فشل تحميل طلبات الاسترجاع");
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    setLogsErr("");
    try {
      const res = await api.get("/admin/refund-logs?limit=300");
      setLogs(res.data || []);
    } catch (e: any) {
      setLogsErr(e?.response?.data?.message || e?.message || "فشل تحميل سجل الاسترجاع");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "logs" && logs.length === 0) loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const approve = async (id: string) => {
    try {
      setBusyId(id);
      await api.post(`/admin/refund-requests/${id}/approve`, {
        adminNote: adminNote[id] || "",
      });
      await load();
      if (tab === "logs") await loadLogs();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "فشل الموافقة");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    try {
      setBusyId(id);
      await api.post(`/admin/refund-requests/${id}/reject`, {
        adminNote: adminNote[id] || "",
      });
      await load();
      if (tab === "logs") await loadLogs();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "فشل الرفض");
    } finally {
      setBusyId(null);
    }
  };

  const filteredLogs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return logs;

    return logs.filter((l) => {
      const userStr = `${l.user?.name || ""} ${l.user?.phone || ""}`.toLowerCase();
      const actionStr = String(l.action || "").toLowerCase();
      const amountStr = String(l.amount ?? "").toLowerCase();
      const refStr = String(l.refId || "").toLowerCase();
      const metaStr = JSON.stringify(l.meta || {}).toLowerCase();
      return (
        userStr.includes(s) ||
        actionStr.includes(s) ||
        amountStr.includes(s) ||
        refStr.includes(s) ||
        metaStr.includes(s)
      );
    });
  }, [logs, q]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin/dashboard"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="الرجوع للوحة التحكم"
            >
              <ChevronRight className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">طلبات استرجاع الرصيد</h1>
          </div>
          <p className="text-slate-500 mt-1 font-medium pr-14">متابعة ومعالجة طلبات سحب الأرصدة للمستخدمين</p>
        </div>

        {/* Tabs Control */}
        <div className="flex bg-white/60 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-slate-200/60 shadow-sm w-fit">
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.2rem] font-black text-sm transition-all duration-300 ${tab === "requests"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
          >
            <RefreshCw className="w-4 h-4" /> الطلبات النشطة
          </button>

          <button
            onClick={() => setTab("logs")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.2rem] font-black text-sm transition-all duration-300 ${tab === "logs"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
          >
            <Activity className="w-4 h-4" /> سجل العمليات
          </button>
        </div>
      </div>

      {tab === "requests" ? (
        <div className="animate-in fade-in duration-500">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
              <p className="font-bold text-slate-500">جاري تحميل الطلبات...</p>
            </div>
          ) : err ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-6 rounded-[2rem] text-center font-bold">
              {err}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 p-16 rounded-[2rem] text-center shadow-sm flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                <RefreshCw className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800">لا توجد طلبات</h3>
              <p className="text-slate-500 font-medium">ليس هناك أي طلبات استرجاع في الوقت الحالي.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {items.map((r) => {
                const isBusy = busyId === r._id;
                return (
                  <div key={r._id} className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                    {/* Background Graphic */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -z-10 pointer-events-none"></div>

                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 z-10 relative">

                      {/* Info Section */}
                      <div className="flex-1 space-y-6">
                        {/* Title Row */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-[1.2rem] flex items-center justify-center shadow-inner">
                              <CreditCard className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                              <div className="text-3xl font-black text-slate-900 tracking-tight">{money(r.amountIQD)}</div>
                              <div className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {r.createdAt ? new Date(r.createdAt).toLocaleString("ar-IQ", { dateStyle: 'long', timeStyle: 'short' }) : ""}</div>
                            </div>
                          </div>
                          <div>{statusLabel(r.status)}</div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100/50">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> المستخدم</h4>
                              <div className="font-bold text-slate-800">{r.user?.name || "—"} <span className="text-primary text-sm font-black mx-1">|</span> <span className="text-slate-500">{r.user?.phone || "—"}</span></div>
                            </div>
                            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-fit">
                              <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الرصيد المتاح</div>
                                <div className="font-black text-slate-900 text-sm">{money(r.user?.balance)}</div>
                              </div>
                              <div className="w-px h-8 bg-slate-200"></div>
                              <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الرصيد المحجوز</div>
                                <div className="font-black text-amber-600 text-sm">{money(r.user?.heldBalance)}</div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> معلومات التحويل</h4>
                              <div className="font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200 shadow-sm whitespace-pre-wrap leading-relaxed text-sm">
                                {r.payoutInfo || "لا توجد تفاصيل"}
                              </div>
                            </div>
                            {r.note && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 mb-1">ملاحظة المستخدم</h4>
                                <div className="text-slate-600 text-sm bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">{r.note}</div>
                              </div>
                            )}
                            {r.status !== "pending" && r.adminNote && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 mb-1">ملاحظة الإدارة المُضافة</h4>
                                <div className="text-slate-600 font-medium text-sm border-r-2 border-indigo-400 pr-3">{r.adminNote}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Section */}
                      <div className="w-full lg:w-[320px] bg-slate-50/80 p-5 rounded-[1.5rem] border border-slate-200 shadow-inner flex flex-col justify-between h-auto lg:h-[340px]">
                        <div>
                          <label className="text-sm font-bold text-slate-700 mb-2 block">ملاحظة الإدارة للعملية (اختياري)</label>
                          <textarea
                            className="w-full bg-white border border-slate-200 rounded-[1rem] p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                            placeholder="اكتب سبب الرفض أو رقم الحوالة هنا..."
                            value={adminNote[r._id] || ""}
                            onChange={(e) => setAdminNote((p) => ({ ...p, [r._id]: e.target.value }))}
                            disabled={r.status !== "pending" || isBusy}
                            rows={4}
                          />
                        </div>

                        <div className="mt-6 space-y-3">
                          <button
                            onClick={() => approve(r._id)}
                            disabled={r.status !== "pending" || isBusy}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[1rem] font-black text-sm transition-all shadow-sm ${r.status !== "pending" || isBusy
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 hover:shadow-lg active:scale-95"
                              }`}
                          >
                            <CheckCircle className="w-4 h-4" /> موافقة على الطلب
                          </button>

                          <button
                            onClick={() => reject(r._id)}
                            disabled={r.status !== "pending" || isBusy}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[1rem] font-black text-sm transition-all shadow-sm ${r.status !== "pending" || isBusy
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              : "bg-white border-2 border-rose-100 text-rose-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:scale-95"
                              }`}
                          >
                            <XCircle className="w-4 h-4" /> رفض الطلب
                          </button>
                        </div>

                        <div className="text-[10px] font-bold text-slate-400 text-center mt-3">
                          عند الضغط على “موافقة” سيتم الخصم تلقائياً. المراجعة النهائية تقع على عاتقك.
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row items-center gap-4 mb-6 relative z-10 w-full">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] pr-12 pl-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold shadow-sm"
                placeholder="بحث سريع (رقم العملية، اسم، هاتف، مبلغ...)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              onClick={loadLogs}
              className="flex items-center gap-2 px-6 py-3.5 rounded-[1.2rem] border border-slate-200/60 font-black bg-white/70 backdrop-blur-xl hover:bg-slate-50 transition-colors shadow-sm w-full md:w-auto justify-center"
              disabled={logsLoading}
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin text-primary" : "text-slate-500"}`} /> {logsLoading ? "تحديث..." : "تحديث السجل"}
            </button>
          </div>

          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
              <p className="font-bold text-slate-500">جاري مسح السجلات...</p>
            </div>
          ) : logsErr ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-6 rounded-[2rem] text-center font-bold">{logsErr}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 p-16 rounded-[2rem] text-center shadow-sm flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                <Activity className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800">لا توجد سجلات مطابقة</h3>
              <p className="text-slate-500 font-medium">حاول تغيير كلمات البحث أو تحديث الصفحة.</p>
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] shadow-sm relative overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right whitespace-nowrap">
                  <thead className="bg-slate-50/50 backdrop-blur-sm border-b border-slate-200/60">
                    <tr>
                      <th className="p-5 font-black text-slate-600">التاريخ والوقت</th>
                      <th className="p-5 font-black text-slate-600">المستخدم</th>
                      <th className="p-5 font-black text-slate-600">الإجراء</th>
                      <th className="p-5 font-black text-slate-600">المبلغ</th>
                      <th className="p-5 font-black text-slate-600">معرف العملية (Ref)</th>
                      <th className="p-5 font-black text-slate-600">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((l) => (
                      <tr key={l._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-5 font-bold text-slate-500">
                          {l.createdAt ? new Date(l.createdAt).toLocaleString("ar-IQ", { dateStyle: 'short', timeStyle: 'short' }) : ""}
                        </td>
                        <td className="p-5">
                          <div className="font-bold text-slate-900">{l.user?.name || "—"}</div>
                          <div className="text-xs font-bold text-slate-400">{l.user?.phone || "—"}</div>
                        </td>
                        <td className="p-5">{actionLabel(l.action)}</td>
                        <td className="p-5 font-black text-slate-900">{money(l.amount)}</td>
                        <td className="p-5 text-slate-500 font-mono text-xs max-w-[120px] truncate" title={l.refId}>{l.refId || "—"}</td>
                        <td className="p-5">
                          <div className="text-slate-600 text-xs whitespace-pre-wrap leading-relaxed max-w-[300px]">
                            {metaSummary(l.meta)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
