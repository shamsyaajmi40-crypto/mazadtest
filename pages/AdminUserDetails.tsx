import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAdminUserDetails, toggleUserBan } from "../services/admin";
import { ArrowRight } from "lucide-react";
import { formatNumber } from "../utils/numberFormat";

const AdminUserDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await getAdminUserDetails(id!);
        setData(res);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id]);

  const handleBanToggle = async () => {
    await toggleUserBan(id!);
    setData((prev: any) => ({
      ...prev,
      user: {
        ...prev.user,
        isBanned: !prev.user.isBanned,
      },
    }));
  };

  if (loading) {
    return <div className="p-6">جاري تحميل بيانات المستخدم...</div>;
  }

  const { user, stats } = data;
  if (!data) {
    return (
      <div className="p-6 text-red-600">
        فشل تحميل بيانات المستخدم
      </div>
    );
  }
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        الرجوع للمستخدمين
      </button>

      <h1 className="text-2xl font-black text-slate-900 mb-6">
        تفاصيل المستخدم
      </h1>

      {/* معلومات المستخدم */}
      <div className="bg-white rounded-xl border p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500">الاسم</p>
          <p className="font-bold">{user.name}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">الهاتف</p>
          <p className="font-bold">{user.phone}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">الدور</p>
          <p className="font-bold">{user.role}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">الحالة</p>
          <p className="font-bold">
            {user.isBanned ? "محظور" : "نشط"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">الرصيد</p>
          <p className="font-bold">{formatNumber(user.balance)}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">الرصيد المعلّق</p>
          <p className="font-bold">{formatNumber(user.heldBalance)}</p>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard title="عدد المزادات" value={stats.auctionsCount} />
        <StatCard title="عدد المزايدات" value={stats.bidsCount} />
        <StatCard title="عدد مرات الفوز" value={stats.winsCount} />
      </div>

      {/* إجراءات */}
      <div className="bg-white rounded-xl border p-6">
        <button
          onClick={handleBanToggle}
          className={`px-4 py-2 rounded text-white ${user.isBanned ? "bg-green-600" : "bg-red-600"
            }`}
        >
          {user.isBanned ? "فك الحظر" : "حظر المستخدم"}
        </button>
      </div>
    </div>
  );
};

export default AdminUserDetails;

/* ---------- */

const StatCard = ({
  title,
  value,
}: {
  title: string;
  value: number;
}) => (
  <div className="bg-white p-6 rounded-xl border">
    <p className="text-sm text-gray-500 mb-1">{title}</p>
    <p className="text-2xl font-black">{value}</p>
  </div>
);
