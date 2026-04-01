// src/components/header/Header.jsx
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Bell, Search, X, CheckCheck, ChevronRight,
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
import { useAppBadge } from "../hooks/useBadge";
import { HeaderSlot } from "../context/HeaderSlotContext";
import {
  DEFAULT_NOTIFICATION_CONFIG,
  NOTIFICATION_CONFIG,
  SEARCH_QUICK_ACTIONS,
  STATUS_DOT_COLOR,
  TYPE_ICON,
  TYPE_LABEL_STYLE,
  iconBtnBase,
  showNotificationToast,
  timeAgo,
} from "./header/header.helpers";

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/api/search", { params: { q: query.trim(), limit: 10 } });
        if (data.success && Array.isArray(data.results)) setResults(data.results);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = useCallback((item) => {
    if (!item?.url) return;
    setOpen(false);
    setQuery("");
    try {
      const updated = [item, ...recent.filter(r => (r._id || r.id) !== (item._id || item.id))].slice(0, 5);
      setRecent(updated);
      localStorage.setItem("recent-searches", JSON.stringify(updated));
    } catch { /* noop */ }
    navigate(item.url);
  }, [navigate, recent]);

  const getTypeIcon = (type) => TYPE_ICON[type] ?? Bell;

  return (
    <>
      {/* ── Search trigger ── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm
                   transition-all duration-150
                   focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text-weak)",
          width: isMobile ? "auto" : 220,
        }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-weak)" }} />
        {!isMobile && (
          <>
            <span className="flex-1 text-left text-[12.5px]" style={{ color: "var(--color-text-weak)" }}>
              Search…
            </span>
            <kbd
              className="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--color-muted-fill)", color: "var(--color-text-sub)" }}
            >
              ⌘K
            </kbd>
          </>
        )}
      </button>

      {/* ── Search dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden max-w-lg"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)" }}
        >
          <Command className="border-none" shouldFilter={false}>
            <div
              className="flex items-center border-b px-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <Search className="w-4 h-4 mr-2 shrink-0" style={{ color: "var(--color-text-weak)" }} />
              <CommandInput
                placeholder="Search tenants, units, payments…"
                value={query}
                onValueChange={setQuery}
                className="border-0 focus:ring-0 py-3 text-sm"
                style={{ color: "var(--color-text-body)" }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="ml-2 transition-colors"
                  style={{ color: "var(--color-text-weak)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <CommandList className="max-h-80">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: "var(--color-border)",
                      borderTopColor: "var(--color-accent)",
                    }}
                  />
                </div>
              )}

              {!loading && query && results.length === 0 && (
                <CommandEmpty
                  className="py-8 text-center text-sm"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  No results for "{query}"
                </CommandEmpty>
              )}

              {!loading && results.length > 0 && (
                <CommandGroup heading="Results">
                  {results.map((item) => {
                    const Icon = getTypeIcon(item.type);
                    const typeStyle = TYPE_LABEL_STYLE[item.type];
                    const dotColor = STATUS_DOT_COLOR[item.badge || item.status];
                    return (
                      <CommandItem
                        key={item._id || item.id}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                        style={{ color: "var(--color-text-body)" }}
                      >
                        <div
                          className="rounded-md p-1.5 shrink-0"
                          style={{
                            background: typeStyle?.bg ?? "var(--color-surface)",
                            color: typeStyle?.color ?? "var(--color-text-sub)",
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name || item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs truncate" style={{ color: "var(--color-text-sub)" }}>
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        {(item.badge || item.status) && dotColor && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{ background: dotColor.bg, color: dotColor.text }}
                          >
                            {item.badge || item.status}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-weak)" }} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Recent searches */}
              {!query && recent.length > 0 && (
                <>
                  <CommandGroup heading="Recent">
                    {recent.map((item) => {
                      const Icon = getTypeIcon(item.type);
                      return (
                        <CommandItem
                          key={item._id || item.id}
                          onSelect={() => handleSelect(item)}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                          style={{ color: "var(--color-text-body)" }}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-sub)" }} />
                          <span className="text-sm">{item.name || item.title}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}

              {/* Quick actions */}
              {!query && (
                <CommandGroup heading="Quick Actions">
                  {SEARCH_QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <CommandItem
                        key={action.label}
                        onSelect={() => {
                          setOpen(false);
                          navigate(action.url);
                        }}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                        style={{ color: "var(--color-text-body)" }}
                      >
                        <div
                          className="rounded-md p-1.5 shrink-0"
                          style={{ background: "var(--color-surface)", color: "var(--color-text-sub)" }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm">{action.label}</span>
                      </CommandItem>
                    );
                  })}
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
function NotificationItem({ notification: n, onMarkRead }) {
  const config = NOTIFICATION_CONFIG[n.type] ?? DEFAULT_NOTIFICATION_CONFIG;
  const Icon = config.icon;
  const dotColor = STATUS_DOT_COLOR[n.status];

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${!n.isRead ? "border-[var(--color-accent-mid)]" : "border-transparent hover:border-[var(--color-border)]"
        }`}
      style={{
        background: n.isRead ? "var(--color-surface)" : "var(--color-accent-light)",
      }}
      onClick={() => !n.isRead && onMarkRead(n._id || n.id)}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: config.bg, color: config.color }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--color-text-strong)" }}>
            {n.title}
          </p>
          {!n.isRead && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ background: "var(--color-accent)" }}
            />
          )}
        </div>

        {n.message && (
          <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--color-text-sub)" }}>
            {n.message}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px]" style={{ color: "var(--color-text-weak)" }}>
            {timeAgo(n.createdAt)}
          </span>
          {dotColor && (
            <>
              <span className="text-[11px]" style={{ color: "var(--color-text-weak)" }}>·</span>
              <span
                className="text-[11px] font-medium"
                style={{ color: dotColor.text }}
              >
                {n.status}
              </span>
            </>
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
      showNotificationToast(n);
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
    /*
      Header is a single flex row: [slot/search grows] [actions pinned right]
      The outer AppLayout header is 57px tall — this fills it edge-to-edge.
    */
    <div className="flex items-center w-full gap-3 h-full">

      {/* ── Left: page-injected slot or global search ── */}
      <div className="flex flex-1 min-w-0 items-center">
        <HeaderSlot fallback={<GlobalSearch />} />
      </div>

      {/* ── Right: action group ── */}
      <div
        className="flex items-center gap-1 shrink-0 pl-3 border-l"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Notification bell */}
        <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
          <SheetTrigger asChild>
            <button
              className={iconBtnBase}
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface-raised)",
              }}
              aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
            >
              <Bell
                className="w-4 h-4"
                style={{ color: hasUnread ? "var(--color-accent)" : "var(--color-text-sub)" }}
              />
              {hasUnread && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full
                             flex items-center justify-center text-[9px] font-bold px-1"
                  style={{ background: "var(--color-danger)", color: "#fff" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </SheetTrigger>

          <SheetContent
            className="flex flex-col p-0 gap-0 w-full sm:max-w-md"
            style={{
              background: "var(--color-surface-raised)",
              borderColor: "var(--color-border)",
            }}
          >
            <SheetHeader
              className="px-5 pt-5 pb-4 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--color-text-strong)" }}
                  >
                    Notifications
                  </SheetTitle>
                  {hasUnread && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
                      {unreadCount} unread
                    </p>
                  )}
                </div>
                {hasUnread && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                               rounded-lg border transition-colors duration-150"
                    style={{
                      color: "var(--color-accent)",
                      borderColor: "var(--color-accent-mid)",
                      background: "var(--color-accent-light)",
                    }}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
            </SheetHeader>

            <div
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--color-bg)" }}
            >
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <Bell className="w-5 h-5" style={{ color: "var(--color-text-weak)" }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-sub)" }}>
                    All caught up
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-weak)" }}>
                    No new notifications
                  </p>
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
      </div>

    </div>
  );
}