import { Bell, Trophy, XCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const NotificationManager = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const fetchNotifications = async () => {

    try {

      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error("Notifications error", err);
    }
  };

  const { user, loading } = useContext(AuthContext);

  // Socket.io Real-time connection
  useEffect(() => {
    let socket: Socket | null = null;
    let handleNotification = (notification: any) => {
      setNotifications((prev) => [notification, ...prev]);

      // ✅ منع ظهور التوست إذا كنا داخل نفس المزاد (لتجنب التكرار مع توست المزايدة المحلي)
      if (notification.event === "OUTBID" && notification.auction) {
        const auctionId = typeof notification.auction === "string" ? notification.auction : notification.auction._id;
        if (location.pathname === `/auction/${auctionId}`) {
          return; // أضفناه للقائمة للقراءة لاحقاً، لكن لا تظهر التوست الآن
        }
      }

      // ✅ إظهار إشعار مرئي على الشاشة
      toast.custom(
        (t) => (
          <div
            className={`max-w-md w-full bg-white shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 ${t.visible ? "animate-enter" : "animate-leave"
              }`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <Bell className="h-6 w-6 text-indigo-500" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-gray-900">
                    {notification.title || "إشعار جديد"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {String(notification.message).replace(/<[^>]*>?/gm, '')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                إغلاق
              </button>
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    };

    if (user) {
      // Initialize Socket connection
      const session = localStorage.getItem("app_session");
      const token = session ? JSON.parse(session)?.token : null;
      socket = io(import.meta.env.VITE_API_URL, {
        transports: ["websocket"],
        auth: { token },
      });

      // Join the user's specific room
      socket.emit("user:join", user._id);

      // Listen for incoming notifications
      socket.on("new_notification", handleNotification);
    }

    return () => {
      if (socket) {
        socket.off("new_notification", handleNotification);
      }
    };
  }, [user]);

  // تعليم جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);

    if (unread.length === 0) return;

    await Promise.all(
      unread.map((n) =>
        api.post(`/notifications/${n._id}/read`)
      )
    );

    // تحديث الواجهة فورًا
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
  };

  // جلب الإشعارات

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string, auctionId: string) => {
    await api.post(`/notifications/${id}/read`);
    setOpen(false);
    navigate(`/auction/${auctionId}`);
  };

  return (
    <div className="relative" ref={ref}>
      {/* زر الجرس */}
      <button
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              fetchNotifications().then(markAllAsRead);
            }
            return next;
          });
        }}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all active:scale-95 ${open
          ? "bg-slate-100 border-slate-300 shadow-inner text-slate-800"
          : "bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:bg-slate-50 text-slate-600"
          }`}
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1.5 rounded-full ring-2 ring-white shadow-sm animate-in zoom-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* القائمة المنسدلة المقاومة للقص (Responsive) بتصميم زجاجي */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95, transformOrigin: "top right" }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="absolute left-[-10px] sm:left-auto sm:right-0 top-full mt-3 w-[85vw] max-w-[380px] bg-white/95 backdrop-blur-xl rounded-[1.5rem] border border-slate-200/60 shadow-2xl z-50 overflow-hidden origin-top-right"
          >

            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="font-black text-slate-800 text-lg">الإشعارات</span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  تحديد كـ مقروء
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center justify-center text-slate-400 gap-3"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="p-4 bg-slate-50 rounded-full border border-slate-100"
                >
                  <Bell className="w-8 h-8 opacity-50" />
                </motion.div>
                <p className="font-bold text-sm">لا توجد إشعارات حالياً</p>
              </motion.div>
            ) : (
              <motion.ul
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                    },
                  },
                }}
                className="max-h-[60vh] overflow-y-auto block scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
              >
                {notifications.map((n) => {
                  // Dynamic colors based on notification type/event
                  let iconColorClass = "bg-blue-50 text-blue-500 border-blue-100";
                  let IconComponent = Info;

                  if (n.type === "WIN" || n.event === "WIN") {
                    iconColorClass = "bg-emerald-50 text-emerald-500 border-emerald-100";
                    IconComponent = Trophy;
                  } else if (n.event === "OUTBID") {
                    iconColorClass = "bg-orange-50 text-orange-500 border-orange-100";
                    IconComponent = AlertTriangle;
                  } else if (n.event === "DISPUTE_REJECTED" || n.event === "AUCTION_REJECTED") {
                    iconColorClass = "bg-rose-50 text-rose-500 border-rose-100";
                    IconComponent = XCircle;
                  } else if (n.event === "AUCTION_APPROVED" || n.event === "DISPUTE_ACCEPTED") {
                    iconColorClass = "bg-emerald-50 text-emerald-500 border-emerald-100";
                    IconComponent = CheckCircle;
                  }

                  return (
                    <motion.li
                      key={n._id}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        visible: { opacity: 1, x: 0 },
                      }}
                      whileHover={{ scale: 1.01, backgroundColor: "rgb(248 250 252)" }} // hover:bg-slate-50 equivalent
                      onClick={() => markAsRead(n._id, n.auction?._id)}
                      className={`flex gap-4 p-4 cursor-pointer border-b border-slate-50 transition-colors
                    ${n.isRead ? "bg-white" : "bg-primary/5"}
                  `}
                    >
                      {/* أيقونة */}
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${iconColorClass}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                      </div>

                      {/* النص */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm pr-2 ${n.isRead ? "font-bold text-slate-700" : "font-black text-slate-900"}`}>
                          {n.title}
                        </p>
                        <p className={`text-xs mt-1 leading-relaxed ${n.isRead ? "text-slate-500 font-medium" : "text-slate-700 font-bold"}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                          {new Date(n.createdAt).toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>

                      {!n.isRead && (
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-sm shadow-primary/30" />
                        </div>
                      )}
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationManager;
