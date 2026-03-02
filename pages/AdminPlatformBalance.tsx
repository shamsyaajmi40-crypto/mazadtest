import { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import { getPlatformBalanceSources } from "../services/admin";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
type GroupedItem = { key: string; total: number; count: number };

type RecentItem = {
  _id?: string;
  createdAt: string;
  auctionId?: string;
  userId?: string;
  amount: number;
  reason?: string;
  action: string;
};

export default function AdminPlatformBalance() {
  const [loading, setLoading] = useState(false);

  // filters
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [q, setQ] = useState<string>("");

  // table paging
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  // data
  const [platformBalance, setPlatformBalance] = useState<number>(0);
  const [todayConfiscations, setTodayConfiscations] = useState<number>(0);
  const [monthConfiscations, setMonthConfiscations] = useState<number>(0);
  const [grouped, setGrouped] = useState<GroupedItem[]>([]);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [pages, setPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const params = useMemo(() => {
    const p: any = {
      groupBy,
      q: q.trim() || undefined,
      page,
      limit,
      // actions optional if you changed naming:
      // actions: "CONFISCATE,CONFISCATE_OK",
    };
    if (from) p.from = new Date(from).toISOString();
    if (to) p.to = new Date(to).toISOString();
    return p;
  }, [from, to, groupBy, q, page, limit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getPlatformBalanceSources(params);
      const data = res.data;

      setPlatformBalance(data.platformBalance || 0);
      setTodayConfiscations(data.todayConfiscations || 0);
      setMonthConfiscations(data.monthConfiscations || 0);
      setGrouped(data.grouped || []);

      setItems(data?.recent?.items || []);
      setPages(data?.recent?.pages || 1);
      setTotal(data?.recent?.total || 0);
    } catch (e) {
      console.error(e);
      alert("فشل جلب بيانات مصادر رصيد المنصة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const formatMoney = (n: number) => {
    try {
      return new Intl.NumberFormat("ar-IQ").format(n);
    } catch {
      return String(n);
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleString("ar-IQ");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/dashboard"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            title="الرجوع للوحة التحكم"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-slate-800">سجلات رصيد المنصة</h2>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="رصيد المنصة الحالي" value={`${formatMoney(platformBalance)} د.ع`} />
        <StatCard title="مصادرات اليوم" value={`${formatMoney(todayConfiscations)} د.ع`} />
        <StatCard title="مصادرات هذا الشهر" value={`${formatMoney(monthConfiscations)} د.ع`} />
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">من تاريخ</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">إلى تاريخ</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">تجميع حسب</label>
          <select
            value={groupBy}
            onChange={(e) => {
              setPage(1);
              setGroupBy(e.target.value as any);
            }}
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          >
            <option value="day">اليوم</option>
            <option value="month">الشهر</option>
          </select>
        </div>

        <div className="flex-[2] min-w-[250px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">بحث (رقم المزاد / المستخدم / السبب)</label>
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="للبحث عن عملية معينة..."
            className="w-full border-slate-200 rounded-lg focus:ring-primary focus:border-primary text-sm"
          />
        </div>
      </div>

      {/* Grouped summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">ملخص حسب {groupBy === "day" ? "اليوم" : "الشهر"}</h3>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد بيانات ضمن الفلتر الحالي</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">الفترة</th>
                    <th className="px-4 py-3">الإجمالي</th>
                    <th className="px-4 py-3">العدد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grouped.map((g) => (
                    <tr key={g.key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">{g.key}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{formatMoney(g.total)} د.ع</td>
                      <td className="px-4 py-3 text-slate-600">{g.count} عمليات</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">سجل العمليات التفصيلي</h3>
          <div className="bg-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-700">
            {total ? `إجمالي العمليات: ${total}` : 'لا توجد عمليات'}
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد عمليات ماليّة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">الوقت</th>
                    <th className="px-4 py-3">رقم المزاد</th>
                    <th className="px-4 py-3">رقم المستخدم</th>
                    <th className="px-4 py-3">المبلغ</th>
                    <th className="px-4 py-3">السبب</th>
                    <th className="px-4 py-3">النوع (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={(it._id || "") + idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(it.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {it.auctionId ? (
                          <Link to={`/auction/${it.auctionId}`} className="text-primary hover:underline" target="_blank">
                            {it.auctionId.slice(-6)}...
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {it.userId ? (
                          <Link to={`/admin/users/${it.userId}`} className="text-primary hover:underline" target="_blank">
                            {it.userId.slice(-6)}...
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                        {formatMoney(it.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={it.reason}>
                        {it.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                          {it.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-6 border-t border-slate-100 pt-6">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                السابق
              </button>

              <div className="text-sm text-slate-500 font-medium">
                صفحة <span className="text-slate-800 font-bold">{page}</span> من <span className="text-slate-800 font-bold">{pages}</span>
              </div>

              <button
                onClick={() => setPage((p) => Math.min(p + 1, pages))}
                disabled={page >= pages || loading}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
