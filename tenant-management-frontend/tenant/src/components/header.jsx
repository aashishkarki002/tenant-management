// src/components/header/Header.jsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  Search,
  X,
  CheckCheck,
  Wrench,
  CreditCard,
  AlertCircle,
  Clock,
  Share,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { socket } from "../../plugins/socket";
import { useEffect, useRef, useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../context/AuthContext";
import api from "../../plugins/axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePushNotifications } from "../hooks/usePushNotification";

// ── Notification type config ───────────────────────────────────────────────────
const NOTIFICATION_CONFIG = {
  PAYMENT_NOTIFICATION: {
    icon: CreditCard,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    label: "Payment",
    labelColor: "bg-emerald-100 text-emerald-700",
  },
  LATE_FEE_NOTIFICATION: {
    icon: AlertCircle,
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-100",
    label: "Late Fee",
    labelColor: "bg-orange-100 text-orange-700",
  },
  RENT_OVERDUE: {
    icon: Clock,
    color: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-100",
    label: "Overdue",
    labelColor: "bg-red-100 text-red-700",
  },
  RENT_PARTIALLY_PAID: {
    icon: CreditCard,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    border: "border-yellow-100",
    label: "Partial",
    labelColor: "bg-yellow-100 text-yellow-700",
  },
  RENT_PAID: {
    icon: CreditCard,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    label: "Paid",
    labelColor: "bg-emerald-100 text-emerald-700",
  },
  RENT_REMINDER: {
    icon: Bell,
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-100",
    label: "Reminder",
    labelColor: "bg-blue-100 text-blue-700",
  },
  MAINTENANCE_CREATED: {
    icon: Wrench,
    color: "text-violet-500",
    bg: "bg-violet-50",
    border: "border-violet-100",
    label: "Maintenance",
    labelColor: "bg-violet-100 text-violet-700",
  },
  MAINTENANCE_ASSIGNED: {
    icon: Wrench,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    label: "Assigned",
    labelColor: "bg-indigo-100 text-indigo-700",
  },
  MAINTENANCE_COMPLETED: {
    icon: Wrench,
    color: "text-teal-500",
    bg: "bg-teal-50",
    border: "border-teal-100",
    label: "Completed",
    labelColor: "bg-teal-100 text-teal-700",
  },
  MAINTENANCE_CANCELLED: {
    icon: Wrench,
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-100",
    label: "Cancelled",
    labelColor: "bg-gray-100 text-gray-500",
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: "text-gray-400",
  bg: "bg-gray-50",
  border: "border-gray-100",
  label: "Notification",
  labelColor: "bg-gray-100 text-gray-600",
};

// Toast messages per type
const TOAST_CONFIG = {
  PAYMENT_NOTIFICATION: { fn: toast.success },
  RENT_PAID: { fn: toast.success },
  RENT_OVERDUE: { fn: toast.error },
  LATE_FEE_NOTIFICATION: { fn: toast.warning },
  MAINTENANCE_COMPLETED: { fn: toast.success },
  MAINTENANCE_ASSIGNED: { fn: toast.info },
  MAINTENANCE_CREATED: { fn: toast.info },
  MAINTENANCE_CANCELLED: { fn: toast.warning },
  RENT_PARTIALLY_PAID: { fn: toast.warning },
  RENT_REMINDER: { fn: toast.info },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Badge colors per search result type ──────────────────────────────────────
const TYPE_STYLES = {
  tenant: "bg-blue-100 text-blue-700",
  rent: "bg-green-100 text-green-700",
  ledger: "bg-orange-100 text-orange-700",
};

const STATUS_DOT = {
  active: "bg-green-400",
  inactive: "bg-gray-400",
  pending: "bg-yellow-400",
  paid: "bg-green-400",
  overdue: "bg-red-400",
  partially_paid: "bg-orange-400",
};

// ── Push Notification Banner ──────────────────────────────────────────────────
// Renders as a standalone block BELOW the header (not inline with bell icon)
export function PushNotificationBanner({ user }) {
  const {
    permissionState,
    isReady,
    isSubscribed,
    isIOS,
    isStandalone,
    requestPermissionAndSubscribe,
  } = usePushNotifications(user);

  const [dismissed, setDismissed] = useState(() => {
    if (!user) return true;
    return localStorage.getItem(`pushDismissed_${user._id || user.id}`) === "true";
  });

  const dismiss = () => {
    if (user) {
      localStorage.setItem(`pushDismissed_${user._id || user.id}`, "true");
    }
    setDismissed(true);
  };

  if (dismissed || !user || !isReady) return null;
  if (isSubscribed || permissionState === "granted") return null;

  // iOS: not installed as PWA
  if (isIOS && !isStandalone) {
    return (
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mx-4 mb-2">
        <Share className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-blue-800">Enable push notifications</p>
          <p className="text-blue-600 mt-0.5">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app and allow notifications.
          </p>
        </div>
        <button onClick={dismiss} className="text-blue-400 hover:text-blue-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Permission denied
  if (permissionState === "denied") {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mx-4 mb-2">
        <BellOff className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-700">Notifications blocked</p>
          <p className="text-red-500 mt-0.5">
            In your browser, go to <strong>Site Settings → Notifications</strong> and allow this site.
          </p>
        </div>
        <button onClick={dismiss} className="text-red-300 hover:text-red-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Default: not yet asked
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mx-4 mb-2">
      <Bell className="w-4 h-4 text-indigo-500 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-indigo-800">Enable push notifications</p>
        <p className="text-indigo-500 mt-0.5 text-xs">
          Get payment and maintenance alerts even when this tab is closed.
        </p>
      </div>
      <button
        onClick={requestPermissionAndSubscribe}
        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        Enable
      </button>
      <button onClick={dismiss} className="text-indigo-300 hover:text-indigo-500 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Global Search ─────────────────────────────────────────────────────────────
function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(
          `/api/search?q=${encodeURIComponent(query)}&limit=5`
        );
        setResults(data.results || []);
        setOpen(true);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (result) => {
    navigate(result.url);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const groups = ["tenant", "rent", "ledger"];
  const groupLabels = { tenant: "Tenants", rent: "Rents", ledger: "Ledger" };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && clearSearch()}
        className="w-full pl-9 pr-8 h-10 text-sm border-gray-300 rounded-md"
        placeholder={isMobile ? "Search…" : "Search tenants, rents, ledger…"}
      />
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute top-full mt-1 left-0 w-full min-w-[300px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400 animate-pulse">
              Searching…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400 text-center">
              No results for <strong>"{query}"</strong>
            </p>
          )}
          {!loading && results.length > 0 && (
            <>
              {groups.map((type) => {
                const group = results.filter((r) => r.type === type);
                if (!group.length) return null;
                return (
                  <div key={type}>
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {groupLabels[type]}
                    </p>
                    {group.map((result) => (
                      <div
                        key={`${result.type}-${result._id}`}
                        onClick={() => handleSelect(result)}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-t border-gray-50"
                      >
                        <span
                          className={`mt-0.5 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${TYPE_STYLES[result.type]}`}
                        >
                          {result.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {result.label}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {result.badge && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[result.badge] ?? "bg-gray-400"}`}
                              />
                            )}
                            <p className="text-xs text-gray-500 truncate">
                              {result.sublabel}
                            </p>
                            {result.meta && (
                              <span className="text-xs text-gray-400 shrink-0">
                                · {result.meta}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-[11px] text-gray-400">
                  Press{" "}
                  <kbd className="bg-white border border-gray-200 rounded px-1 text-[10px]">
                    Esc
                  </kbd>{" "}
                  to close
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notification Item ─────────────────────────────────────────────────────────
function NotificationItem({ notification, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);
  const config = NOTIFICATION_CONFIG[notification.type] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  const handleExpand = () => {
    setExpanded((v) => !v);
    if (!notification.isRead) {
      onMarkRead(notification._id || notification.id);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${notification.isRead
          ? "bg-white border-gray-100"
          : `${config.bg} ${config.border}`
        }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notification.isRead ? "bg-gray-100" : config.bg
            }`}
        >
          <Icon
            className={`w-4 h-4 ${notification.isRead ? "text-gray-400" : config.color}`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.labelColor}`}
            >
              {config.label}
            </span>
            {!notification.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            )}
          </div>
          <p
            className={`text-sm font-semibold mt-1 ${notification.isRead ? "text-gray-600" : "text-gray-900"
              }`}
          >
            {notification.title}
          </p>

          {/* Expandable message */}
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1 transition-colors"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {expanded ? "Hide details" : "View details"}
          </button>

          {expanded && (
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed bg-white/70 rounded-lg px-2.5 py-2 border border-gray-100">
              {notification.message}
            </p>
          )}

          {notification.createdAt && (
            <p className="text-[11px] text-gray-400 mt-1.5">
              {timeAgo(notification.createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header() {
  const [notifications, setNotifications] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  const isTenantsPage =
    location.pathname === "/tenants" ||
    location.pathname === "/tenant/tenants";

  // ── Fetch unread notifications on mount (server is source of truth) ────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get("/api/notification/get-notifications");
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    fetchNotifications();
  }, [user, loading, fetchNotifications]);

  // Re-fetch when sheet opens (catches notifications from other tabs/sessions)
  useEffect(() => {
    if (sheetOpen && user) {
      fetchNotifications();
    }
  }, [sheetOpen, user, fetchNotifications]);

  // ── Mark actions ─────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        (n._id || n.id) === notificationId ? { ...n, isRead: true } : n
      )
    );
    try {
      await api.patch(
        `/api/notification/mark-notification-as-read/${notificationId}`
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic update — mark all as read but keep them visible
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.patch("/api/notification/mark-all-notifications-as-read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      // Revert on failure
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // ── Socket: real-time notifications ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      socket.disconnect();
      return;
    }

    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      const adminId = user._id || user.id;
      if (adminId) socket.emit("join:admin", adminId);
    };

    const handleNewNotification = (data) => {
      const notification = data.notification;
      if (!notification) return;

      // Prepend to list
      setNotifications((prev) => {
        // Deduplicate by _id in case of duplicate socket events
        const id = notification._id || notification.id;
        if (prev.some((n) => (n._id || n.id) === id)) return prev;
        return [notification, ...prev];
      });

      // Toast with the right style for each notification type
      const toastConfig = TOAST_CONFIG[notification.type];
      const toastFn = toastConfig?.fn ?? toast;
      toastFn(notification.title, {
        description: notification.message,
        duration: 5000,
      });
    };

    socket.on("connect", handleConnect);
    socket.on("new-notification", handleNewNotification);

    // Emit join immediately if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("new-notification", handleNewNotification);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  return (
    <div className="flex flex-wrap sm:flex-nowrap justify-between items-center sm:p-4 w-full gap-4">
      {!isTenantsPage && <GlobalSearch />}

      {/* Notification Bell */}
      <div className={isTenantsPage ? "ml-auto" : ""}>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-10 h-10 rounded-full relative"
            >
              <Bell className="w-5 h-5 text-gray-500" />
              {hasUnread && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent className="flex flex-col p-0 gap-0 w-full sm:max-w-md">
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-base font-semibold">
                    Notifications
                  </SheetTitle>
                  {hasUnread && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {unreadCount} unread
                    </p>
                  )}
                </div>
                {hasUnread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5 h-8"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    All caught up
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    No new notifications
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification._id || notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                  />
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}