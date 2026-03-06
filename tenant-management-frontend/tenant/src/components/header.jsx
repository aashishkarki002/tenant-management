// src/components/header/Header.jsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Bell, BellOff, Search, X, CheckCheck, Wrench, CreditCard,
  AlertCircle, Clock, Share, ChevronRight, PlusCircle,
  Users, Receipt, BookOpen, UserPlus, FileText,
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

// ─── Notification config — re-mapped to brand palette ────────────────────────
const NOTIFICATION_CONFIG = {
  PAYMENT_NOTIFICATION: { icon: CreditCard, color: "text-[#2E7A4A]", bg: "bg-[#D4EDE0]", border: "border-[#2E7A4A]/20", label: "Payment", labelColor: "bg-[#D4EDE0] text-[#1D4A2E]" },
  LATE_FEE_NOTIFICATION: { icon: AlertCircle, color: "text-[#C4721A]", bg: "bg-[#FAEBD3]", border: "border-[#C4721A]/20", label: "Late Fee", labelColor: "bg-[#FAEBD3] text-[#5C3A10]" },
  RENT_OVERDUE: { icon: Clock, color: "text-[#B02020]", bg: "bg-[#F5D5D5]", border: "border-[#B02020]/20", label: "Overdue", labelColor: "bg-[#F5D5D5] text-[#5C1414]" },
  RENT_PARTIALLY_PAID: { icon: CreditCard, color: "text-[#C4721A]", bg: "bg-[#FAEBD3]", border: "border-[#C4721A]/20", label: "Partial", labelColor: "bg-[#FAEBD3] text-[#5C3A10]" },
  RENT_PAID: { icon: CreditCard, color: "text-[#2E7A4A]", bg: "bg-[#D4EDE0]", border: "border-[#2E7A4A]/20", label: "Paid", labelColor: "bg-[#D4EDE0] text-[#1D4A2E]" },
  RENT_REMINDER: { icon: Bell, color: "text-[#2E5A8C]", bg: "bg-[#D4E4F5]", border: "border-[#2E5A8C]/20", label: "Reminder", labelColor: "bg-[#D4E4F5] text-[#1A2E4A]" },
  MAINTENANCE_CREATED: { icon: Wrench, color: "text-[#C4721A]", bg: "bg-[#FAEBD3]", border: "border-[#C4721A]/20", label: "Maintenance", labelColor: "bg-[#FAEBD3] text-[#5C3A10]" },
  MAINTENANCE_ASSIGNED: { icon: Wrench, color: "text-[#2E5A8C]", bg: "bg-[#D4E4F5]", border: "border-[#2E5A8C]/20", label: "Assigned", labelColor: "bg-[#D4E4F5] text-[#1A2E4A]" },
  MAINTENANCE_COMPLETED: { icon: Wrench, color: "text-[#2E7A4A]", bg: "bg-[#D4EDE0]", border: "border-[#2E7A4A]/20", label: "Done", labelColor: "bg-[#D4EDE0] text-[#1D4A2E]" },
  MAINTENANCE_CANCELLED: { icon: Wrench, color: "text-[#948472]", bg: "bg-[#EEE9E5]", border: "border-[#DDD6D0]", label: "Cancelled", labelColor: "bg-[#EEE9E5] text-[#625848]" },
};
const DEFAULT_CONFIG = { icon: Bell, color: "text-[#948472]", bg: "bg-[#EEE9E5]", border: "border-[#DDD6D0]", label: "Notification", labelColor: "bg-[#EEE9E5] text-[#625848]" };

const TOAST_CONFIG = {
  PAYMENT_NOTIFICATION: { fn: toast.success }, RENT_PAID: { fn: toast.success },
  RENT_OVERDUE: { fn: toast.error }, LATE_FEE_NOTIFICATION: { fn: toast.warning },
  MAINTENANCE_COMPLETED: { fn: toast.success }, MAINTENANCE_ASSIGNED: { fn: toast.info },
  MAINTENANCE_CREATED: { fn: toast.info }, MAINTENANCE_CANCELLED: { fn: toast.warning },
  RENT_PARTIALLY_PAID: { fn: toast.warning }, RENT_REMINDER: { fn: toast.info },
};

const TYPE_STYLES = {
  tenant: "bg-[#D4E4F5] text-[#1A2E4A]",
  rent: "bg-[#D4EDE0] text-[#1D4A2E]",
  ledger: "bg-[#FAEBD3] text-[#5C3A10]",
};
const STATUS_DOT = {
  active: "bg-[#2E7A4A]", inactive: "bg-[#948472]", pending: "bg-[#C4721A]",
  paid: "bg-[#2E7A4A]", overdue: "bg-[#B02020]", partially_paid: "bg-[#C4721A]",
};
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

// ─── Push Notification Banner — on-brand ─────────────────────────────────────
export function PushNotificationBanner({ user }) {
  const { permissionState, isReady, isSubscribed, isIOS, isStandalone, requestPermissionAndSubscribe } =
    usePushNotifications(user);
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
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 mx-4 mb-2 border"
        style={{ background: "#D4E4F5", borderColor: "rgba(46,90,140,0.25)" }}>
        <Share className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#2E5A8C" }} />
        <div className="flex-1 text-sm">
          <p className="font-semibold" style={{ color: "#1A2E4A" }}>Add to Home Screen for notifications</p>
          <p className="mt-0.5 text-xs" style={{ color: "#2E5A8C" }}>
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app and allow notifications.
          </p>
        </div>
        <button onClick={dismiss} className="transition-colors" style={{ color: "#2E5A8C" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (permissionState === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 mx-4 mb-2 border"
        style={{ background: "#F5D5D5", borderColor: "rgba(176,32,32,0.25)" }}>
        <BellOff className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#B02020" }} />
        <div className="flex-1 text-sm">
          <p className="font-semibold" style={{ color: "#5C1414" }}>Notifications blocked</p>
          <p className="mt-0.5 text-xs" style={{ color: "#B02020" }}>
            Go to <strong>Site Settings → Notifications</strong> and allow <strong>app.sallyanhouse.com</strong>
          </p>
        </div>
        <button onClick={dismiss} className="transition-colors" style={{ color: "#C47272" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 mx-4 mb-2 border"
      style={{ background: "#EEE9E5", borderColor: "#DDD6D0" }}>
      <Bell className="w-4 h-4 shrink-0" style={{ color: "#3D1414" }} />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-[13px]" style={{ color: "#3D1414" }}>
          Stay on top of payments &amp; maintenance
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#948472" }}>
          Enable notifications to get alerts even when this tab is closed.
        </p>
      </div>
      <button
        onClick={requestPermissionAndSubscribe}
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
                   hover:opacity-90 active:scale-95"
        style={{ background: "#3D1414", color: "#F0DADA" }}
      >
        Enable
      </button>
      <button onClick={dismiss} className="transition-colors" style={{ color: "#C8BDB6" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Global Search ────────────────────────────────────────────────────────────
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(v => !v); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/api/search", { params: { q: query } });
        setResults(data.results || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [query]);

  const handleSelect = (item) => {
    setOpen(false);
    const updated = [item, ...recent.filter(r => r.id !== item.id)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem("recent-searches", JSON.stringify(updated));
    const routes = { tenant: `/tenants/${item.id}`, rent: `/rent-payment/${item.id}`, ledger: `/accounting/${item.id}` };
    if (routes[item.type]) navigate(routes[item.type]);
  };

  const TypeIcon = (type) => TYPE_ICON[type] ?? Bell;

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                   transition-all duration-150 hover:border-[#C8BDB6] hover:bg-[#F8F5F2]
                   focus:outline-none focus:ring-2 focus:ring-[#3D1414]/20"
        style={{ borderColor: "#DDD6D0", background: "#F8F5F2", color: "#948472", minWidth: isMobile ? "auto" : 220 }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: "#AFA097" }} />
        {!isMobile && (
          <>
            <span className="flex-1 text-left text-[13px]">Search tenants, units…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "#EEE9E5", color: "#948472" }}>
              ⌘K
            </kbd>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg border-[#DDD6D0]">
          <Command className="border-none">
            <div className="flex items-center border-b px-3" style={{ borderColor: "#EEE9E5" }}>
              <Search className="w-4 h-4 mr-2 shrink-0" style={{ color: "#AFA097" }} />
              <CommandInput
                placeholder="Search tenants, units, payments…"
                value={query}
                onValueChange={setQuery}
                className="border-0 focus:ring-0 py-3 text-sm placeholder:text-[#AFA097]"
              />
              {query && (
                <button onClick={() => setQuery("")} className="ml-2" style={{ color: "#AFA097" }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <CommandList className="max-h-80">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-[#3D1414]/20 border-t-[#3D1414] animate-spin" />
                </div>
              )}
              {!loading && query && results.length === 0 && (
                <CommandEmpty className="py-8 text-center text-sm" style={{ color: "#948472" }}>
                  No results for "{query}"
                </CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup heading="Results">
                  {results.map((item) => {
                    const Icon = TypeIcon(item.type);
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer
                                   aria-selected:bg-[#F8F5F2]"
                      >
                        <div className={`rounded-md p-1.5 shrink-0 ${TYPE_STYLES[item.type] ?? "bg-[#EEE9E5]"}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#1C1A18" }}>{item.name}</p>
                          {item.sub && <p className="text-xs truncate" style={{ color: "#948472" }}>{item.sub}</p>}
                        </div>
                        {item.status && (
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[item.status] ?? "bg-[#948472]"}`} />
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {!query && recent.length > 0 && (
                <>
                  <CommandGroup heading="Recent">
                    {recent.map((item) => {
                      const Icon = TypeIcon(item.type);
                      return (
                        <CommandItem
                          key={item.id}
                          onSelect={() => handleSelect(item)}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer aria-selected:bg-[#F8F5F2]"
                        >
                          <Icon className="w-4 h-4 shrink-0" style={{ color: "#AFA097" }} />
                          <span className="text-sm truncate" style={{ color: "#413D38" }}>{item.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              {!query && (
                <CommandGroup heading="Quick actions">
                  {[
                    { label: "Record a payment", icon: Receipt, route: "/rent-payment?action=new" },
                    { label: "Add new tenant", icon: UserPlus, route: "/tenants?action=new" },
                    { label: "Log maintenance", icon: Wrench, route: "/maintenance?action=new" },
                    { label: "View all units", icon: BookOpen, route: "/units" },
                  ].map((a) => (
                    <CommandItem
                      key={a.label}
                      onSelect={() => { setOpen(false); navigate(a.route); }}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer aria-selected:bg-[#F8F5F2]"
                    >
                      <div className="rounded-md p-1.5 shrink-0 bg-[#EEE9E5]">
                        <a.icon className="w-3.5 h-3.5" style={{ color: "#3D1414" }} />
                      </div>
                      <span className="text-sm" style={{ color: "#413D38" }}>{a.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: "#C8BDB6" }} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Notification Item ────────────────────────────────────────────────────────
function NotificationItem({ notification, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);
  const config = NOTIFICATION_CONFIG[notification.type] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  const handleExpand = (e) => {
    e.stopPropagation();
    if (!notification.isRead) onMarkRead(notification._id || notification.id);
    setExpanded(v => !v);
  };

  return (
    <div
      className={`rounded-xl p-3.5 border transition-all ${config.border} ${notification.isRead ? "opacity-60" : ""
        }`}
      style={{ background: notification.isRead ? "#FDFCFA" : "white" }}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.labelColor}`}>
              {config.label}
            </span>
            {!notification.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3D1414] shrink-0" />
            )}
          </div>
          <p className={`text-sm font-semibold mt-1 ${notification.isRead ? "text-[#756F67]" : "text-[#1C1A18]"}`}>
            {notification.title}
          </p>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 text-xs mt-1 transition-colors"
            style={{ color: "#AFA097" }}
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            {expanded ? "Hide" : "Details"}
          </button>
          {expanded && (
            <p className="text-xs mt-1.5 leading-relaxed rounded-lg px-2.5 py-2 border"
              style={{ color: "#413D38", background: "#F8F5F2", borderColor: "#EEE9E5" }}>
              {notification.message}
            </p>
          )}
          {notification.createdAt && (
            <p className="text-[11px] mt-1.5" style={{ color: "#AFA097" }}>
              {timeAgo(notification.createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Header (default export) ──────────────────────────────────────────────────
export default function Header() {
  const [notifications, setNotifications] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/api/notification/get-notifications");
      if (data.success) setNotifications(data.notifications || []);
    } catch (err) { console.error(err); }
  }, [user]);

  useEffect(() => { if (!loading && user) fetchNotifications(); }, [user, loading, fetchNotifications]);
  useEffect(() => { if (sheetOpen && user) fetchNotifications(); }, [sheetOpen, user, fetchNotifications]);

  useEffect(() => {
    const handler = (e) => {
      const id = e.detail;
      setNotifications(prev => prev.map(n => (n._id || n.id) === id ? { ...n, isRead: true } : n));
    };
    window.addEventListener("notification:read", handler);
    return () => window.removeEventListener("notification:read", handler);
  }, []);

  const markAsRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => (n._id || n.id) === id ? { ...n, isRead: true } : n));
    try { await api.patch(`/api/notification/mark-notification-as-read/${id}`); }
    catch (err) { console.error(err); }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try { await api.patch("/api/notification/mark-all-notifications-as-read"); }
    catch { fetchNotifications(); }
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) { socket.disconnect(); return; }
    if (!socket.connected) socket.connect();
    const handleConnect = () => {
      const id = user._id || user.id;
      if (id) socket.emit("join:admin", id);
    };
    const handleNewNotification = (data) => {
      const n = data.notification;
      if (!n) return;
      setNotifications(prev => {
        const id = n._id || n.id;
        if (prev.some(x => (x._id || x.id) === id)) return prev;
        return [n, ...prev];
      });
      const fn = TOAST_CONFIG[n.type]?.fn ?? toast;
      fn(n.title, { description: n.message, duration: 5000 });
    };
    socket.on("connect", handleConnect);
    socket.on("new-notification", handleNewNotification);
    if (socket.connected) handleConnect();
    return () => {
      socket.off("connect", handleConnect);
      socket.off("new-notification", handleNewNotification);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasUnread = unreadCount > 0;
  useAppBadge(unreadCount);

  const handleSheetOpenChange = (open) => {
    setSheetOpen(open);
    if (open) navigator.clearAppBadge?.();
  };

  return (
    <header className="flex items-center w-full gap-3">

      {/* Search or page-injected slot */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <HeaderSlot fallback={<GlobalSearch />} />
      </div>



      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetTrigger asChild>
          <button
            className="relative w-9 h-9 rounded-lg flex items-center justify-center
                       border transition-all duration-150 hover:bg-[#F8F5F2] shrink-0
                       focus:outline-none focus:ring-2 focus:ring-[#3D1414]/20"
            style={{ borderColor: "#DDD6D0", background: "white" }}
          >
            <Bell className="w-4 h-4" style={{ color: hasUnread ? "#3D1414" : "#AFA097" }} />
            {hasUnread && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full
                           flex items-center justify-center text-[10px] font-bold px-1"
                style={{ background: "#B02020", color: "white" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </SheetTrigger>

        <SheetContent className="flex flex-col p-0 gap-0 w-full sm:max-w-md border-l border-[#DDD6D0]">
          <SheetHeader className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#EEE9E5" }}>
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base font-semibold" style={{ color: "#1C1A18" }}>
                  Notifications
                </SheetTitle>
                {hasUnread && (
                  <p className="text-xs mt-0.5" style={{ color: "#948472" }}>
                    {unreadCount} unread
                  </p>
                )}
              </div>
              {hasUnread && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                             rounded-lg border transition-colors hover:bg-[#F8F5F2]"
                  style={{ color: "#3D1414", borderColor: "#DDD6D0" }}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
            style={{ background: "#F8F5F2" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: "#EEE9E5" }}>
                  <Bell className="w-5 h-5" style={{ color: "#C8BDB6" }} />
                </div>
                <p className="text-sm font-medium" style={{ color: "#756F67" }}>All caught up</p>
                <p className="text-xs mt-1" style={{ color: "#AFA097" }}>No new notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n._id || n.id}
                  notification={n}
                  onMarkRead={markAsRead}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

    </header>
  );
}