
import {
  HashRouter,
  Routes,
  Route,
  Navigate,

  Outlet,
  Link,
  useLocation, useNavigate,
} from "react-router-dom";
import type { User } from "./types";

import Wallet from "./pages/Wallet";
import Home from "./pages/Home";
import AuctionDetails from "./pages/AuctionDetails";
import CreateAuction from "./pages/CreateAuction";
import { Toaster } from "react-hot-toast";
import AdminDashboard from "./pages/AdminDashboard";
import TopBar from "./components/TopBar";
import AdminCompletedAuctions from "./pages/AdminCompletedAuctions";
import UserProfile from "./pages/UserProfile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import FAQ from "./pages/FAQ";
import { AuthContext } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { useState, useEffect, useContext, type ReactNode, } from "react";
import api from "./services/api";
import ArchivedAuctions from "./pages/ArchivedAuctions";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetails from "./pages/AdminUserDetails";
import EndingSoonAuctions from "./pages/EndingSoonAuctions";
import AdminPlatformBalance from "./pages/AdminPlatformBalance";
import AdminDepositPolicy from "./pages/AdminDepositPolicy";
import Pricing from "./pages/Pricing";
import AdminRefundRequests from "./pages/AdminRefundRequests";
import CourierAgentDashboard from "./pages/CourierAgentDashboard";
import CourierStaffDashboard from "./pages/CourierStaffDashboard";
import AdminCourierManagement from "./pages/AdminCourierManagement";
import OpenDeals from "./pages/OpenDeals";
import AdminDisputes from "./pages/AdminDisputes";
import AdminFeaturedAuctions from "./pages/AdminFeaturedAuctions";
import AdminKYC from "./pages/AdminKYC";

/* =======================
   Auth Context
======================= */
const RoleGate = () => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <div className="p-10 text-center">جاري التحميل…</div>;

  // غير مسجّل: خليه يكمل (Landing/Login)
  if (!user) return <Outlet />;

  const isAgent = user.role === "courier_agent";
  const isStaff = user.role === "courier_staff";

  // إذا المستخدم كورير: امنعه من أي شيء غير لوحته
  if (isAgent && location.pathname !== "/courier/agent") {
    return <Navigate to="/courier/agent" replace />;
  }
  if (isStaff && location.pathname !== "/courier/staff") {
    return <Navigate to="/courier/staff" replace />;
  }

  return <Outlet />;
};

const session = localStorage.getItem("app_session");
const parsed = session ? JSON.parse(session) : {};
const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("app_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.user) {
          setUser(parsed.user);
        }
      } catch {
        localStorage.removeItem("app_session");
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem("app_session");
    setUser(null);
  };
  const refreshUser = async () => {
    const res = await api.get("/users/me");

    setUser(res.data);

    const session = localStorage.getItem("app_session");
    const parsed = session ? JSON.parse(session) : {};

    localStorage.setItem(
      "app_session",
      JSON.stringify({
        ...parsed,     // ✅ يحافظ على token
        user: res.data,
      })
    );
    return res.data;
  };



  return (
    <AuthContext.Provider
      value={{ user, setUser, refreshUser, loading, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};


/* =======================
   Protected Route
======================= */

const ProtectedRoute = ({
  children,
  requireAdmin,
  requireSuperAdmin,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="p-10 text-center">جاري التحميل…</div>;
  if (!user) return <Navigate to="/" replace />;

  if (requireSuperAdmin && user.role !== "superAdmin")
    return <Navigate to="/" replace />;

  if (
    requireAdmin &&
    user.role !== "admin" &&
    user.role !== "superAdmin"
  )
    return <Navigate to="/" replace />;

  return <>{children}</>;
};

/* =======================
   App
======================= */
const TopBarGuarded = () => {
  const { user } = useContext(AuthContext);
  const isCourier = user?.role === "courier_agent" || user?.role === "courier_staff";
  if (isCourier) return null;
  return <TopBar />;
};

const CourierRedirectGate = () => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const isAgent = user.role === "courier_agent";
    const isStaff = user.role === "courier_staff";
    if (!isAgent && !isStaff) return;

    const allowedPath = isAgent ? "/courier/agent" : "/courier/staff";
    if (location.pathname !== allowedPath) {
      navigate(allowedPath, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return null;
};
const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#334155',
              fontWeight: 'bold',
              borderRadius: '1rem',
              padding: '16px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
            },
          }}
        />
        <HashRouter>
          {/* يمنع الكورير من أي صفحات غير لوحته */}
          <CourierRedirectGate />

          {/* لا نعرض التوب بار للكورير */}
          <TopBarGuarded />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auction/:id" element={<AuctionDetails />} />
            <Route path="/archived" element={<ArchivedAuctions />} />
            <Route path="/ending-soon" element={<EndingSoonAuctions />} />
            <Route
              path="/admin/courier"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminCourierManagement />
                </ProtectedRoute>
              }
            />



            <Route path="/admin/refund-requests" element={<AdminRefundRequests />} />

            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <Pricing />
                </ProtectedRoute>
              }
            />

            {/* ✅ صفحات الكورير مباشرة بدون RoleGate */}
            <Route
              path="/courier/agent"
              element={
                <ProtectedRoute>
                  <CourierAgentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courier/staff"
              element={
                <ProtectedRoute>
                  <CourierStaffDashboard />
                </ProtectedRoute>
              }
            />



            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/disputes"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDisputes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/platform-balance"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPlatformBalance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/featured-auctions"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFeaturedAuctions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/deposit-policy"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDepositPolicy />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users/:id"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUserDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/kyc"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminKYC />
                </ProtectedRoute>
              }
            />

            <Route
              path="/deals/open"
              element={
                <ProtectedRoute>
                  <OpenDeals />
                </ProtectedRoute>
              }
            />

            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/faq" element={<FAQ />} />

            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              }
            />

            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <CreateAuction />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/users/:id" element={<UserProfile />} />



            <Route
              path="/admin/completed-auctions"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminCompletedAuctions />
                </ProtectedRoute>
              }
            />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
