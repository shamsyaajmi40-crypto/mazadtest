import React, { useState, useContext } from "react";
import { X, Loader2, UserPlus, LogIn, CheckCircle2 } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { login as loginService, register as registerService } from "../services/auth";
import { Link, useNavigate } from "react-router-dom";

interface LoginModalProps {
  onClose: () => void;
}

type Step = "LOGIN" | "REGISTER";

const GOVERNORATES = [
  "بغداد", "البصرة", "نينوى", "أربيل", "السليمانية", "دهوك", "كركوك",
  "الأنبار", "ديالى", "بابل", "كربلاء", "النجف", "صلاح الدين", "واسط",
  "القادسية", "ميسان", "المثنى", "ذي قار",
];

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("LOGIN");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [governorate, setGovernorate] = useState(GOVERNORATES[0]);
  const [address, setAddress] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectByRole = (role?: string) => {
    if (role === "courier_agent") return "/courier/agent";
    if (role === "courier_staff") return "/courier/staff";
    return "/";
  };

  /* ---------------- LOGIN ---------------- */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await loginService({ phone, password });
      setUser(user);
      navigate(redirectByRole(user?.role), { replace: true });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "رقم الهاتف أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- REGISTER ---------------- */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      setError("يجب الموافقة على سياسة الخصوصية وجدول العمولات للمتابعة");
      return;
    }

    setError("");


    setLoading(true);

    try {
      const user = await registerService({
        phone,
        email,
        password,
        name,
        governorate,
        address,
      });
      setUser(user);
      navigate(redirectByRole(user?.role), { replace: true });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "فشل إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className="fixed inset-0 bg-black/40"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              {step === "LOGIN" ? (
                <>
                  <LogIn className="w-5 h-5 text-primary" /> تسجيل الدخول
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-primary" /> إنشاء حساب
                </>
              )}
            </h3>
            <button onClick={onClose}>
              <X />
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          {step === "LOGIN" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="tel"
                placeholder="رقم الهاتف"
                className="w-full px-4 py-3 border rounded-xl text-center"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                className="w-full px-4 py-3 border rounded-xl text-center"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "دخول"}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                ليس لديك حساب؟{" "}
                <button
                  type="button"
                  onClick={() => setStep("REGISTER")}
                  className="text-primary font-bold"
                >
                  إنشاء حساب
                </button>
              </p>
            </form>
          )}

          {step === "REGISTER" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder="الاسم الكامل"
                className="w-full px-4 py-3 border rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                className="w-full px-4 py-3 border rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="رقم الهاتف"
                className="w-full px-4 py-3 border rounded-xl text-center"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                className="w-full px-4 py-3 border rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <select
                className="w-full px-4 py-3 border rounded-xl"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
              >
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="العنوان"
                className="w-full px-4 py-3 border rounded-xl"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                أوافق على{" "}
                <Link to="/privacy" className="text-primary font-bold">
                  سياسة الخصوصية
                </Link>{" "}
                و{" "}
                <Link to="/privacy#fees" className="text-primary font-bold">
                  جدول الرسوم والعمولات
                </Link>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "إكمال التسجيل"}
              </button>

              <button
                type="button"
                onClick={() => setStep("LOGIN")}
                className="w-full text-center text-sm text-gray-500"
              >
                العودة لتسجيل الدخول
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
