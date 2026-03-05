// src/components/header/Header.jsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Bell, BellOff, Search, X, CheckCheck, Wrench, CreditCard,
  AlertCircle, Clock, Share, ChevronRight, LayoutDashboard,
  PlusCircle, Users, Receipt, BookOpen,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { socket } from "../../plugins/socket";
import { useEffect, useRef, useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../context/AuthContext";
import api from "../../plugins/axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePushNotifications } from "../hooks/usePushNotification";
import { useAppBadge } from "../hooks/useBadge";
import { HeaderSlot } from "../context/HeaderSlotContext";

// ─────────────────────────────────────────────────────────────────────────────
// Config maps (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const NOTIFICATION_CONFIG = {
  PAYMENT_NOTIFICATION: { icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100", label: "Payment", labelColor: "bg-emerald-100 text-emerald-700" },
  LATE_FEE_NOTIFICATION: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100", label: "Late Fee", labelColor: "bg-orange-100 text-orange-700" },
  RENT_OVERDUE: { icon: Clock, color: "text-red-500", bg: "bg-red-50", border: "border-red-100", label: "Overdue", labelColor: "bg-red-100 text-red-700" },
  RENT_PARTIALLY_PAID: { icon: CreditCard, color: "text-yellow-500", bg: "bg-yellow-50", border: "border-yellow-100", label: "Partial", labelColor: "bg-yellow-100 text-yellow-700" },
  RENT_PAID: { icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100", label: "Paid", labelColor: "bg-emerald-100 text-emerald-700" },
  RENT_REMINDER: { icon: Bell, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100", label: "Reminder", labelColor: "bg-blue-100 text-blue-700" },
  MAINTENANCE_CREATED: { icon: Wrench, color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100", label: "Maintenance", labelColor: "bg-violet-100 text-violet-700" },
  MAINTENANCE_ASSIGNED: { icon: Wrench, color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-100", label: "Assigned", labelColor: "bg-indigo-100 text-indigo-700" },
  MAINTENANCE_COMPLETED: { icon: Wrench, color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-100", label: "Completed", labelColor: "bg-teal-100 text-teal-700" },
  MAINTENANCE_CANCELLED: { icon: Wrench, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-100", label: "Cancelled", labelColor: "bg-gray-100 text-gray-500" },
};
const DEFAULT_CONFIG = { icon: Bell, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-100", label: "Notification", labelColor: "bg-gray-100 text-gray-600" };
const TOAST_CONFIG = {
  PAYMENT_NOTIFICATION: { fn: toast.success }, RENT_PAID: { fn: toast.success },
  RENT_OVERDUE: { fn: toast.error }, LATE_FEE_NOTIFICATION: { fn: toast.warning },
  MAINTENANCE_COMPLETED: { fn: toast.success }, MAINTENANCE_ASSIGNED: { fn: toast.info },
  MAINTENANCE_CREATED: { fn: toast.info }, MAINTENANCE_CANCELLED: { fn: toast.warning },
  RENT_PARTIALLY_PAID: { fn: toast.warning }, RENT_REMINDER: { fn: toast.info },
};
const TYPE_STYLES = { tenant: "bg-blue-100 text-blue-700", rent: "bg-green-100 text-green-700", ledger: "bg-orange-100 text-orange-700" };
const STATUS_DOT = { active: "bg-green-400", inactive: "bg-gray-400", pending: "bg-yellow-400", paid: "bg-green-400", overdue: "bg-red-400", partially_paid: "bg-orange-400" };
const TYPE_ICON = { tenant: Users, rent: Receipt, ledger: BookOpen };

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

// ─────────────────────────────────────────────────────────────────────────────
// PushNotificationBanner (named export — used in AppLayout)
// ─────────────────────────────────────────────────────────────────────────────
export function PushNotificationBanner({ user }) {
  const { permissionState, isReady, isSubscribed, isIOS, isStandalone, requestPermissionAndSubscribe } = usePushNotifications(user);
  const [dismissed, setDismissed] = useState(() => {
    if (!user) return true;
    return localStorage.getItem(`pushDismissed_${user._id || user.id}`) === "true";
  });
  const dismiss = () => {
    if (user) localStorage.setItem(`pushDismissed_${user._id || user.id}`, "true");
    setDismissed(true);
  };
  if (dismissed || !user || !isReady || isSubscribed || permissionState === "granted") return null;
  if (isIOS && !isStandalone) {
    return (
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mx-4 mb-2">
        <Share className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-blue-800">Enable push notifications</p>
          <p className="text-blue-600 mt-0.5">Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app from your home screen and allow notifications.</p>
        </div>
        <button onClick={dismiss} className="text-blue-400 hover:text-blue-600 transition-colors"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  if (permissionState === "denied") {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mx-4 mb-2">
        <BellOff className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-700">Notifications blocked</p>
          <p className="text-red-500 mt-0.5">In your browser go to <strong>Site Settings → Notifications</strong> and allow <strong>app.sallyanhouse.com</strong>.</p>
        </div>
        <button onClick={dismiss} className="text-red-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mx-4 mb-2">
      <Bell className="w-4 h-4 text-indigo-500 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-indigo-800">Enable push notifications</p>
        <p className="text-indigo-500 mt-0.5 text-xs">Get payment and maintenance alerts even when this tab is closed.</p>
      </div>
      <button onClick={requestPermissionAndSubscribe} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Enable</button>
      <button onClick={dismiss} className="text-indigo-300 hover:text-indigo-500 transition-colors"><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlobalSearch (default fallback when no page injects a slot)
// ─────────────────────────────────────────────────────────────────────────────
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("recent-searches") || "[]"); }
    catch { return []; }
  });
  const debounceRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const down = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/search?q=${encodeURIComponent(query)}&limit=6`);
        setResults(data.results || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const saveRecent = (item) => {
    const updated = [item, ...recent.filter((r) => r._id !== item._id)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem("recent-searches", JSON.stringify(updated));
  };

  const handleSelect = (item) => { saveRecent(item); navigate(item.url); setOpen(false); setQuery(""); };

  const grouped = {
    tenant: results.filter((r) => r.type === "tenant"),
    rent: results.filter((r) => r.type === "rent"),
    ledger: results.filter((r) => r.type === "ledger"),
  };

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const shortcut = isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 w-full max-w-xs bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 hover:bg-white hover:border-slate-300 transition-all duration-150"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left text-xs truncate">{isMobile ? "Search…" : "Search tenants, rents, ledger…"}</span>
        {!isMobile && (
          <kbd className="ml-auto inline-flex items-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm shrink-0">{shortcut}</kbd>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <DialogContent className="overflow-hidden p-0 shadow-xl max-w-lg">
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-400">
            <CommandInput placeholder="Search tenants, rents, ledger…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && <div className="px-4 py-3 text-sm text-slate-400 animate-pulse">Searching…</div>}
              {!query && (
                <>
                  <CommandGroup heading="Quick Actions">
                    <CommandItem onSelect={() => { navigate("/"); setOpen(false); }}><LayoutDashboard className="w-4 h-4 mr-2 text-slate-400" />Go to Dashboard</CommandItem>
                    <CommandItem onSelect={() => { navigate("/tenants/create"); setOpen(false); }}><PlusCircle className="w-4 h-4 mr-2 text-slate-400" />Add New Tenant</CommandItem>
                  </CommandGroup>
                  {recent.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Recent">
                        {recent.map((item) => {
                          const Icon = TYPE_ICON[item.type] || Clock;
                          return (
                            <CommandItem key={item._id} value={item._id} onSelect={() => handleSelect(item)}>
                              <Icon className="w-4 h-4 mr-2 text-slate-400" />
                              <span className="flex-1 truncate">{item.label}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLES[item.type]}`}>{item.type}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
              {query.length >= 2 && !loading && results.length === 0 && <CommandEmpty>No results for "{query}"</CommandEmpty>}
              {Object.entries(grouped).map(([type, items]) => {
                if (!items.length) return null;
                const label = { tenant: "Tenants", rent: "Rents", ledger: "Ledger" }[type];
                const Icon = TYPE_ICON[type];
                return (
                  <CommandGroup key={type} heading={label}>
                    {items.map((item) => (
                      <CommandItem key={item._id} value={item._id} onSelect={() => handleSelect(item)}>
                        <Icon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">{item.label}</span>
                          {item.sublabel && <span className="text-xs text-slate-400 truncate">{item.sublabel}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {item.badge && <span className={`w-2 h-2 rounded-full ${STATUS_DOT[item.badge] ?? "bg-gray-400"}`} />}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLES[item.type]}`}>{item.type}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationItem
// ─────────────────────────────────────────────────────────────────────────────
function NotificationItem({ notification, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);
  const config = NOTIFICATION_CONFIG[notification.type] ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const handleExpand = () => { setExpanded((v) => !v); if (!notification.isRead) onMarkRead(notification._id || notification.id); };
  return (
    <div className={`rounded-xl border p-3 transition-all ${notification.isRead ? "bg-white border-gray-100" : `${config.bg} ${config.border}`}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notification.isRead ? "bg-gray-100" : config.bg}`}>
          <Icon className={`w-4 h-4 ${notification.isRead ? "text-gray-400" : config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.labelColor}`}>{config.label}</span>
            {!notification.isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
          </div>
          <p className={`text-sm font-semibold mt-1 ${notification.isRead ? "text-gray-600" : "text-gray-900"}`}>{notification.title}</p>
          <button onClick={handleExpand} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1 transition-colors">
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            {expanded ? "Hide details" : "View details"}
          </button>
          {expanded && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed bg-white/70 rounded-lg px-2.5 py-2 border border-gray-100">{notification.message}</p>}
          {notification.createdAt && <p className="text-[11px] text-gray-400 mt-1.5">{timeAgo(notification.createdAt)}</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header (default export)
// ─────────────────────────────────────────────────────────────────────────────
export default function Header() {
  const [notifications, setNotifications] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, loading } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get("/api/notification/get-notifications");
      if (response.data.success) setNotifications(response.data.notifications || []);
    } catch (error) { console.error("Error fetching notifications:", error); }
  }, [user]);

  useEffect(() => { if (loading || !user) return; fetchNotifications(); }, [user, loading, fetchNotifications]);
  useEffect(() => { if (sheetOpen && user) fetchNotifications(); }, [sheetOpen, user, fetchNotifications]);

  useEffect(() => {
    const handler = (e) => {
      const id = e.detail;
      setNotifications((prev) => prev.map((n) => ((n._id || n.id) === id ? { ...n, isRead: true } : n)));
    };
    window.addEventListener("notification:read", handler);
    return () => window.removeEventListener("notification:read", handler);
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    setNotifications((prev) => prev.map((n) => (n._id || n.id) === notificationId ? { ...n, isRead: true } : n));
    try { await api.patch(`/api/notification/mark-notification-as-read/${notificationId}`); }
    catch (error) { console.error("Error marking as read:", error); }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await api.patch("/api/notification/mark-all-notifications-as-read"); }
    catch (error) { console.error("Error marking all as read:", error); fetchNotifications(); }
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) { socket.disconnect(); return; }
    if (!socket.connected) socket.connect();
    const handleConnect = () => { const adminId = user._id || user.id; if (adminId) socket.emit("join:admin", adminId); };
    const handleNewNotification = (data) => {
      const notification = data.notification;
      if (!notification) return;
      setNotifications((prev) => {
        const id = notification._id || notification.id;
        if (prev.some((n) => (n._id || n.id) === id)) return prev;
        return [notification, ...prev];
      });
      const toastFn = TOAST_CONFIG[notification.type]?.fn ?? toast;
      toastFn(notification.title, { description: notification.message, duration: 5000 });
    };
    socket.on("connect", handleConnect);
    socket.on("new-notification", handleNewNotification);
    if (socket.connected) handleConnect();
    return () => { socket.off("connect", handleConnect); socket.off("new-notification", handleNewNotification); };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;
  useAppBadge(unreadCount);

  const handleSheetOpenChange = (open) => { setSheetOpen(open); if (open) navigator.clearAppBadge?.(); };

  return (
    <header className="flex items-center w-full gap-3">

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <HeaderSlot fallback={<GlobalSearch />} />
      </div>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-10 h-10 rounded-full relative">
              <Bell className="w-5 h-5 text-gray-500" />
              {hasUnread && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col p-0 gap-0 w-full sm:max-w-md">
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
                  {hasUnread && <p className="text-xs text-gray-400 mt-0.5">{unreadCount} unread</p>}
                </div>
                {hasUnread && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5 h-8">
                    <CheckCheck className="w-3.5 h-3.5" />Mark all read
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">All caught up</p>
                  <p className="text-xs text-gray-400 mt-1">No new notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem key={notification._id || notification.id} notification={notification} onMarkRead={markAsRead} />
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}