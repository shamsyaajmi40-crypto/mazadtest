import { useEffect, useState } from "react";
import { getAdminUsers, toggleUserBan } from "../services/admin";
import { useNavigate } from "react-router-dom";
import { UserCheck, Eye, Search, Ban, UserX, Shield, ShieldAlert, ArrowRight, ArrowLeft, ChevronRight, Trash2, UserCog, User as UserIcon } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { useContext } from "react";

type User = {
  _id: string;
  name: string;
  phone: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
};

export default function AdminUsers() {
  const { user: currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const highlightText = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    const regex = new RegExp(`(${query})`, "ig");
    const parts = text.split(regex);
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-primary/20 text-primary px-1 rounded-sm font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const res = await getAdminUsers(page, 10, debouncedSearch, roleFilter, statusFilter);
        setUsers(res.users);
        setTotalPages(res.pagination.totalPages);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 700);
    return () => clearTimeout(timer);
  }, [search]);

  const handleBanToggle = async (id: string) => {
    await toggleUserBan(id);
    setUsers((prev) =>
      prev.map((u) =>
        u._id === id ? { ...u, isBanned: !u.isBanned } : u
      )
    );
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟ سيتم حذف جميع بياناته ولا يمكن التراجع عن هذا الإجراء.")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success("تم حذف المستخدم بنجاح");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء حذف المستخدم");
    }
  };

  const handleRoleToggle = async (id: string) => {
    if (!confirm("هل أنت متأكد من تغيير صلاحيات هذا المستخدم؟")) return;
    try {
      const { data } = await api.patch(`/admin/users/${id}/role`);
      toast.success(data.message);
      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, role: data.role } : u))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء تعديل الصلاحيات");
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "superAdmin":
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case "admin":
        return <Shield className="w-4 h-4 text-indigo-500" />;
      default:
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin/dashboard"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="الرجوع للوحة التحكم"
            >
              <ChevronRight className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">إدارة المستخدمين</h1>
          </div>
          <p className="text-slate-500 mt-1 font-medium pr-14">بحث وتصفية والتحكم في حسابات المستخدمين</p>
        </div>
      </div>

      {/* Filters (Glassmorphism) */}
      <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 p-5 rounded-[2rem] mb-8 shadow-sm flex flex-col md:flex-row gap-4 relative z-10">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (page !== 1) setPage(1);
            }}
            className="w-full bg-white/50 border border-slate-200/60 rounded-[1.2rem] pr-12 pl-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold placeholder:font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setPage(1);
              setRoleFilter(e.target.value);
            }}
            className="w-full md:w-40 bg-white/50 border border-slate-200/60 rounded-[1.2rem] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-700"
          >
            <option value="">كل الأدوار</option>
            <option value="user">مستخدم عادي</option>
            <option value="admin">إدمن</option>
            <option value="superAdmin">سوبر إدمن</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="w-full md:w-40 bg-white/50 border border-slate-200/60 rounded-[1.2rem] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-700"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="banned">محظور</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold">جاري تحميل النتائج...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-gray-500 font-bold flex flex-col items-center gap-3">
            <UserX className="w-12 h-12 text-slate-300" />
            لا يوجد مستخدمين يطابقون بحثك.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right whitespace-nowrap">
              <thead className="bg-slate-50/50 backdrop-blur-sm border-b border-slate-200/60">
                <tr>
                  <th className="p-5 font-black text-slate-600">المستخدم</th>
                  <th className="p-5 font-black text-slate-600">رقم الهاتف</th>
                  <th className="p-5 font-black text-slate-600">الدور</th>
                  <th className="p-5 font-black text-slate-600">الحالة</th>
                  <th className="p-5 font-black text-slate-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                          {u.name.charAt(0)}
                        </div>
                        <div className="font-bold text-slate-900">
                          {highlightText(u.name, debouncedSearch)}
                        </div>
                      </div>
                    </td>
                    <td className="p-5 font-medium text-slate-600">{highlightText(u.phone, debouncedSearch)}</td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border ${u.role === "superAdmin" ? "bg-rose-50 text-rose-700 border-rose-100" :
                        u.role === "admin" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                        {getRoleIcon(u.role)}
                        {u.role === 'superAdmin' ? 'Super Admin' : u.role === 'admin' ? 'الإدارة' : 'مستخدم'}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border ${u.isBanned ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}>
                        {u.isBanned ? <><Ban className="w-3.5 h-3.5" /> محظور</> : <><UserCheck className="w-3.5 h-3.5" /> نشط</>}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleBanToggle(u._id)}
                          className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${u.isBanned
                            ? "bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            : "bg-white border-rose-200 text-rose-600 hover:bg-rose-50"
                            }`}
                          title={u.isBanned ? "فك الحظر" : "حظر المستخدم"}
                        >
                          {u.isBanned ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>

                        {currentUser?.role === "superAdmin" && u.role !== "superAdmin" && (
                          <button
                            onClick={() => handleRoleToggle(u._id)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all"
                            title={u.role === "admin" ? "تخفيض إلى مستخدم" : "ترقية إلى مدير"}
                          >
                            <UserCog className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all"
                          title="حذف المستخدم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => navigate(`/users/${u._id}`)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all"
                          title="عرض الملف الشخصي العام"
                        >
                          <UserIcon className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => navigate(`/admin/users/${u._id}`)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                          title="عرض بيانات الإدارة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="flex items-center gap-3 bg-white/50 backdrop-blur p-2 rounded-full border border-slate-200/50 shadow-sm w-fit">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-slate-600"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-600 px-4">
              صفحة {page} من {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-slate-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
