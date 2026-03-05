import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Truck, Plus, CheckCircle, XCircle, Users, Phone, Building2, MapPin, Search, PlusCircle, ServerCrash, X, ChevronRight, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

type CourierCompany = {
  _id: string;
  name: string;
  phone?: string;
  deliveryFee?: number;
  isActive?: boolean;
  coverage?: { from: string; to: string[] }[];
  branches?: { governorate: string; name: string; address: string }[];
  createdAt?: string;
};

type CourierStaff = {
  _id: string;
  name: string;
  phone: string;
  blocked?: boolean;
  createdAt?: string;
};

const AdminCourierManagement = () => {
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const selectedCompany = useMemo(
    () => companies.find((c) => c._id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const [staff, setStaff] = useState<CourierStaff[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Create company modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyFee, setNewCompanyFee] = useState<string>("0");
  const [selectedCompanyFee, setSelectedCompanyFee] = useState<string>("0");

  // Advanced features modals
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<{ from: string; to: string[] }[]>([]);

  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const [editingBranches, setEditingBranches] = useState<{ governorate: string; name: string; address: string }[]>([]);

  // Iraq Governorates for dropdowns
  const GOVERNORATES = [
    "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "كركوك",
    "الأنبار", "ذي قار", "بابل", "صلاح الدين", "السليمانية", "دهوك",
    "واسط", "ميسان", "الديوانية", "المثنى", "ديالى", "الكل"
  ];

  // Create staff modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");

  const fetchCompanies = async () => {
    setErr(null);
    setLoadingCompanies(true);
    try {
      const { data } = await api.get("/admin/courier-companies");
      setCompanies(data || []);
      if (!selectedCompanyId && (data?.[0]?._id)) {
        setSelectedCompanyId(data[0]._id);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل جلب الشركات");
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchCompanyStaff = async (companyId: string) => {
    if (!companyId) return;
    setErr(null);
    setLoadingStaff(true);
    try {
      const { data } = await api.get(`/admin/courier-companies/${companyId}/staff`);
      setStaff(data || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل جلب موظفي الشركة");
    } finally {
      setLoadingStaff(false);
    }
  };

  const createCompany = async () => {
    setErr(null);
    if (!newCompanyName.trim()) {
      setErr("اسم الشركة مطلوب");
      return;
    }
    try {
      const feeNum = Number(newCompanyFee || 0);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        setErr("مبلغ التوصيل يجب أن يكون رقمًا غير سالب");
        return;
      }
      await api.post("/admin/courier-companies", {
        name: newCompanyName.trim(),
        phone: newCompanyPhone.trim(),
        deliveryFee: feeNum,
        isActive: true,
      });
      setShowCompanyModal(false);
      setNewCompanyName("");
      setNewCompanyPhone("");
      setNewCompanyFee("0");
      await fetchCompanies();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل إنشاء الشركة");
    }
  };

  const toggleCompanyActive = async (company: CourierCompany) => {
    setErr(null);
    try {
      await api.patch(`/admin/courier-companies/${company._id}`, {
        isActive: company.isActive === false ? true : false,
      });
      await fetchCompanies();
      if (selectedCompanyId) await fetchCompanyStaff(selectedCompanyId);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل تحديث الشركة");
    }
  };

  const updateSelectedCompanyFee = async () => {
    if (!selectedCompanyId) return;
    setErr(null);
    const feeNum = Number(selectedCompanyFee || 0);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      setErr("مبلغ التوصيل يجب أن يكون رقمًا غير سالب");
      return;
    }
    try {
      await api.patch(`/admin/courier-companies/${selectedCompanyId}`, {
        deliveryFee: feeNum,
      });
      await fetchCompanies();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل تحديث مبلغ التوصيل");
    }
  };

  const saveCoverage = async () => {
    if (!selectedCompanyId) return;
    try {
      await api.patch(`/admin/courier-companies/${selectedCompanyId}`, {
        coverage: editingCoverage,
      });
      setShowCoverageModal(false);
      await fetchCompanies();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "فشل حفظ التغطية");
    }
  };

  const saveBranches = async () => {
    if (!selectedCompanyId) return;
    try {
      await api.patch(`/admin/courier-companies/${selectedCompanyId}`, {
        branches: editingBranches,
      });
      setShowBranchesModal(false);
      await fetchCompanies();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "فشل حفظ الفروع");
    }
  };

  const createStaffForCompany = async () => {
    setErr(null);
    if (!selectedCompanyId) {
      setErr("اختر شركة أولاً");
      return;
    }
    if (!newStaffName || !newStaffPhone || !newStaffPassword) {
      setErr("أدخل الاسم + الهاتف + كلمة المرور");
      return;
    }

    try {
      await api.post(`/admin/courier-companies/${selectedCompanyId}/staff`, {
        name: newStaffName.trim(),
        phone: newStaffPhone.trim(),
        password: newStaffPassword,
      });

      setShowStaffModal(false);
      setNewStaffName("");
      setNewStaffPhone("");
      setNewStaffPassword("");

      await fetchCompanyStaff(selectedCompanyId);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل إنشاء موظف الشركة");
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!selectedCompanyId) return;
    if (!confirm("هل أنت متأكد من حذف هذا المندوب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;

    try {
      await api.delete(`/admin/courier-companies/${selectedCompanyId}/staff/${staffId}`);
      setStaff((prev) => prev.filter((s) => s._id !== staffId));
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message || "فشل حذف المندوب");
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCompanyId) fetchCompanyStaff(selectedCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  useEffect(() => {
    setSelectedCompanyFee(String(Number(selectedCompany?.deliveryFee || 0)));
  }, [selectedCompany?._id, selectedCompany?.deliveryFee]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    return companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone && c.phone.includes(searchQuery)));
  }, [companies, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary/80" /> إدارة الطرود والتوصيل
          </h1>
          <p className="text-slate-500 mt-1 font-medium">إدارة شركات التوصيل، موظفيهم وحالاتهم</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchCompanies}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[1.2rem] border border-slate-200/60 font-black bg-white/70 backdrop-blur-xl hover:bg-slate-50 transition-colors shadow-sm text-sm"
            disabled={loadingCompanies}
          >
            {loadingCompanies ? <ServerCrash className="w-4 h-4 animate-bounce text-primary" /> : <ServerCrash className="w-4 h-4 text-slate-500" />} {loadingCompanies ? "تحديث..." : "تحديث البيانات"}
          </button>

          <button
            onClick={() => setShowCompanyModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.2rem] transition-all font-black shadow-md shadow-slate-900/20 text-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4" /> إضافة شركة جديدة
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-8 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 backdrop-blur p-4 flex items-start gap-3 text-rose-700 font-bold animate-in fade-in slide-in-from-top-4">
          <XCircle className="w-6 h-6 flex-shrink-0" />
          <p className="pt-0.5">{err}</p>
          <button onClick={() => setErr(null)} className="mr-auto text-rose-500 hover:text-rose-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: Companies list */}
        <div className="flex flex-col gap-4">

          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 p-5 rounded-[2rem] shadow-sm relative z-10">
            <div className="flex items-center gap-2 bg-slate-50/50 border border-slate-200/50 rounded-[1rem] px-4 py-2 mb-4">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث عن شركة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm font-bold w-full focus:outline-none placeholder:text-slate-400 text-slate-700"
              />
            </div>

            <div className="font-black text-slate-800 mb-4 flex items-center justify-between">
              قائمة الشركات
              <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">{filteredCompanies.length}</span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pl-2 custom-scrollbar">
              {loadingCompanies ? (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-bold text-sm">جاري التحميل...</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-bold text-sm bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                  لا توجد نتائج.
                </div>
              ) : (
                filteredCompanies.map((c) => {
                  const active = c.isActive !== false;
                  const selected = c._id === selectedCompanyId;
                  return (
                    <button
                      key={c._id}
                      onClick={() => setSelectedCompanyId(c._id)}
                      className={`w-full text-right rounded-[1.2rem] p-4 transition-all group relative overflow-hidden text-right border ${selected
                        ? "bg-slate-900 border-slate-800 shadow-md transform scale-[1.02]"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                    >
                      <div className={`absolute top-0 right-0 w-1 h-full ${active ? (selected ? "bg-emerald-400" : "bg-emerald-500") : "bg-rose-500"} opacity-70`}></div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-none ${selected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"}`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className={`font-black text-sm mb-1 ${selected ? "text-white" : "text-slate-900"}`}>{c.name}</div>
                            <div className={`text-xs font-bold flex items-center gap-1.5 ${selected ? "text-slate-400" : "text-slate-500"}`}>
                              <Phone className="w-3 h-3" /> {c.phone || "لا يوجد رقم"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected company staff */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col h-full min-h-[500px]">

            {!selectedCompanyId ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                <Truck className="w-20 h-20 text-slate-300 mb-4" />
                <h2 className="text-xl font-black text-slate-500">اختر شركة من القائمة</h2>
                <p className="text-slate-400 font-bold mt-2">لعرض تفاصيل موظفيها وإدارتها.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-black text-2xl text-slate-900 tracking-tight flex items-center gap-3">
                        {selectedCompany?.name || "—"}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${selectedCompany?.isActive === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {selectedCompany?.isActive === false ? "شركة معطلة" : "شركة نشطة"}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" /> مسجلة في النظام
                      </div>
                      <div className="text-sm font-black text-slate-700 mt-1">
                        أجرة التوصيل: {Number(selectedCompany?.deliveryFee || 0).toLocaleString()} د.ع
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-[1rem] px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={selectedCompanyFee}
                        onChange={(e) => setSelectedCompanyFee(e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 focus:outline-none"
                        placeholder="أجرة التوصيل"
                      />
                      <button
                        onClick={updateSelectedCompanyFee}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-800"
                      >
                        حفظ الأجرة
                      </button>
                    </div>
                    <button
                      onClick={() => selectedCompany && toggleCompanyActive(selectedCompany)}
                      className={`px-4 py-2 rounded-[1rem] font-black text-xs transition-colors flex items-center gap-2 border ${selectedCompany?.isActive === false
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                        : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                        }`}
                    >
                      {selectedCompany?.isActive === false ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {selectedCompany?.isActive === false ? "تفعيل الشركة" : "تعطيل الشركة"}
                    </button>

                    <button
                      onClick={() => {
                        setEditingCoverage(selectedCompany?.coverage || []);
                        setShowCoverageModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-[1rem] font-black text-xs transition-colors flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4" /> نطاق التوصيل
                    </button>

                    <button
                      onClick={() => {
                        setEditingBranches(selectedCompany?.branches || []);
                        setShowBranchesModal(true);
                      }}
                      className="px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-[1rem] font-black text-xs transition-colors flex items-center gap-2"
                    >
                      <Building2 className="w-4 h-4" /> فروع الإستلام
                    </button>

                    <button
                      onClick={() => setShowStaffModal(true)}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-[1rem] font-black text-xs transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> إضافة مندوب
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-slate-400" />
                    <h3 className="text-lg font-black text-slate-800">قائمة المناديب</h3>
                    <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2 py-0.5 rounded-full">{staff.length}</span>
                  </div>

                  {loadingStaff ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                      <div className="text-sm font-bold text-slate-500">استرداد بيانات المندوبين...</div>
                    </div>
                  ) : staff.length === 0 ? (
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 py-16 border-dashed">
                      <Users className="w-10 h-10 text-slate-300" />
                      <div className="text-sm font-bold text-slate-400">لا يوجد مندوبون مدرجون ضمن هذه الشركة بعد.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {staff.map((s) => (
                        <div key={s._id} className="bg-white border border-slate-200 rounded-[1.2rem] p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 group-hover:text-primary transition-colors">{s.name}</div>
                              <div className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${s.blocked ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                              {s.blocked ? "تم الحظر" : "نشط"}
                            </div>
                            <button
                              onClick={() => handleDeleteStaff(s._id)}
                              title="حذف المندوب"
                              className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      {/* Create company modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-indigo-500"></div>

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" /> إضافة شركة جديدة
              </h2>
              <button
                onClick={() => setShowCompanyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">اسم الشركة <span className="text-rose-500">*</span></label>
                <input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="مثال: الفارس السريع..."
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">رقم الهاتف (اختياري)</label>
                <input
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left"
                  placeholder="07xxxxxx"
                  dir="ltr"
                  inputMode="tel"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">مبلغ التوصيل (د.ع)</label>
                <input
                  value={newCompanyFee}
                  onChange={(e) => setNewCompanyFee(e.target.value)}
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left"
                  placeholder="0"
                  dir="ltr"
                  inputMode="numeric"
                />
              </div>

              <button
                onClick={createCompany}
                className="w-full rounded-[1.2rem] bg-slate-900 hover:bg-slate-800 text-white py-3.5 font-black text-sm mt-4 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                disabled={!newCompanyName.trim()}
              >
                تحديث وحفظ الشركة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create staff modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-500" /> تفاصيل المندوب الجديد
              </h2>
              <button
                onClick={() => setShowStaffModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-bold text-slate-500 mb-6 bg-slate-50 p-2 rounded-lg inline-block border border-slate-100">
              شركة: <span className="text-slate-800">{selectedCompany?.name}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">الاسم الكامل</label>
                <input
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="محمد أحمد..."
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">رقم الهاتف <span className="text-[10px] text-slate-400 font-normal">(يستخدم لتسجيل الدخول)</span></label>
                <input
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-left"
                  placeholder="07xxxxxx"
                  dir="ltr"
                  inputMode="tel"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block">كلمة المرور</label>
                <input
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="w-full rounded-[1rem] bg-slate-50 border border-slate-200 px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-left"
                  placeholder="••••••••"
                  type="password"
                  dir="ltr"
                />
              </div>

              <button
                onClick={createStaffForCompany}
                className="w-full rounded-[1.2rem] bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 shadow-lg text-white py-3.5 font-black text-sm mt-6 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                disabled={!selectedCompanyId || !newStaffName || !newStaffPhone || !newStaffPassword || newStaffPassword.length < 6}
              >
                إنشاء وصول للمندوب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coverage Modal */}
      {showCoverageModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <MapPin className="text-indigo-500" /> تعديل مسارات التوصيل ({selectedCompany?.name})
              </h2>
              <button onClick={() => setShowCoverageModal(false)} className="text-slate-400 hover:text-rose-500">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {editingCoverage.map((route, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">مسار {idx + 1}</span>
                    <button onClick={() => setEditingCoverage(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 text-sm font-bold flex items-center"><Trash2 className="w-4 h-4 ml-1" /> حذف المسار</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">يستلم البضاعة من محافظة:</label>
                      <select
                        value={route.from}
                        onChange={(e) => {
                          const newCov = [...editingCoverage];
                          newCov[idx].from = e.target.value;
                          setEditingCoverage(newCov);
                        }}
                        className="w-full rounded-lg border-slate-200 bg-white p-2 text-sm font-bold"
                      >
                        <option value="">اختر محافظة</option>
                        {GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">يوصلها إلى محافظات: (مفصولة بفاصلة)</label>
                      <input
                        value={route.to.join(", ")}
                        onChange={(e) => {
                          const newCov = [...editingCoverage];
                          newCov[idx].to = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          setEditingCoverage(newCov);
                        }}
                        placeholder="بغداد, البصرة, أربيل (أو اكتب الكل)"
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditingCoverage([...editingCoverage, { from: "", to: [] }])}
                className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50"
              >
                <PlusCircle className="w-5 h-5" /> إضافة مسار جديد
              </button>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end">
              <button onClick={saveCoverage} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700">
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branches Modal */}
      {showBranchesModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Building2 className="text-amber-500" /> تعديل فروع الإستلام ({selectedCompany?.name})
              </h2>
              <button onClick={() => setShowBranchesModal(false)} className="text-slate-400 hover:text-rose-500">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {editingBranches.map((branch, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">فرع {idx + 1}</span>
                    <button onClick={() => setEditingBranches(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 text-sm font-bold flex items-center"><Trash2 className="w-4 h-4 ml-1" /> حذف</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">المحافظة:</label>
                      <select
                        value={branch.governorate}
                        onChange={(e) => {
                          const newBr = [...editingBranches];
                          newBr[idx].governorate = e.target.value;
                          setEditingBranches(newBr);
                        }}
                        className="w-full rounded-lg border-slate-200 bg-white p-2 text-sm font-bold"
                      >
                        <option value="">اختر...</option>
                        {GOVERNORATES.filter(g => g !== 'الكل').map(gov => <option key={gov} value={gov}>{gov}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">اسم الفرع:</label>
                      <input
                        value={branch.name}
                        onChange={(e) => {
                          const newBr = [...editingBranches];
                          newBr[idx].name = e.target.value;
                          setEditingBranches(newBr);
                        }}
                        placeholder="فرع المنصور"
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">العنوان التفصيلي:</label>
                      <input
                        value={branch.address}
                        onChange={(e) => {
                          const newBr = [...editingBranches];
                          newBr[idx].address = e.target.value;
                          setEditingBranches(newBr);
                        }}
                        placeholder="مجاور مول المنصور..."
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditingBranches([...editingBranches, { governorate: "", name: "", address: "" }])}
                className="w-full py-3 border-2 border-dashed border-amber-200 text-amber-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-50"
              >
                <PlusCircle className="w-5 h-5" /> إضافة فرع جديد
              </button>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end">
              <button onClick={saveBranches} className="bg-amber-500 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-amber-600">
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminCourierManagement;
