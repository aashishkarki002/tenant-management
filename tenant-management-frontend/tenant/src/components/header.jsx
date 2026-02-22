import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, X } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { socket } from "../../plugins/socket";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../context/AuthContext";
import api from "../../plugins/axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ── Badge colors per result type ──────────────────────────────────────────────
const TYPE_STYLES = {
  tenant: "bg-blue-100 text-blue-700",
  rent: "bg-green-100 text-green-700",
  ledger: "bg-orange-100 text-orange-700",
};

// Status dot colors mapped to your existing statuses
const STATUS_DOT = {
  active: "bg-green-400",
  inactive: "bg-gray-400",
  pending: "bg-yellow-400",
  paid: "bg-green-400",
  overdue: "bg-red-400",
  partially_paid: "bg-orange-400",
};

// ── Inline GlobalSearch (uses your existing `api` axios instance) ─────────────
function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Debounced search
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
        const { data } = await api.get(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
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

  // Close on outside click
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
      {/* Input */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && clearSearch()}
        className="w-full pl-9 pr-8 h-10 text-sm border-gray-300 rounded-md"
        placeholder={
          isMobile ? "Search…" : "Search tenants, rents, ledger…"
        }
      />
      {/* Clear button */}
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full min-w-[300px] bg-white
                        border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">

          {/* Loading */}
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400 animate-pulse">
              Searching…
            </p>
          )}

          {/* No results */}
          {!loading && results.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400 text-center">
              No results for <strong>"{query}"</strong>
            </p>
          )}

          {/* Grouped results */}
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
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50
                                   cursor-pointer transition-colors border-t border-gray-50"
                      >
                        {/* Type pill */}
                        <span className={`mt-0.5 shrink-0 text-[10px] font-semibold
                                          px-1.5 py-0.5 rounded-md ${TYPE_STYLES[result.type]}`}>
                          {result.type}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {result.label}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {/* Status dot */}
                            {result.badge && (
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0
                                                ${STATUS_DOT[result.badge] ?? "bg-gray-400"}`} />
                            )}
                            <p className="text-xs text-gray-500 truncate">{result.sublabel}</p>
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

              {/* Footer */}
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

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header() {
  const [notifications, setNotifications] = useState([]);
  const { user, loading } = useAuth();
  const location = useLocation();
  const isTenantsPage =
    location.pathname === "/tenants" ||
    location.pathname === "/tenant/tenants";

  // ── Notifications cleared state ──────────────────────────────────────────
  const getNotificationsCleared = () => {
    if (!user) return false;
    const userId = user._id || user.id;
    return localStorage.getItem(`notificationsCleared_${userId}`) === "true";
  };

  const [notificationsCleared, setNotificationsCleared] = useState(
    () => getNotificationsCleared()
  );

  useEffect(() => {
    if (!user) return;
    const userId = user._id || user.id;
    if (notificationsCleared) {
      localStorage.setItem(`notificationsCleared_${userId}`, "true");
    } else {
      localStorage.removeItem(`notificationsCleared_${userId}`);
    }
  }, [notificationsCleared, user]);

  useEffect(() => {
    if (user) {
      setNotificationsCleared(getNotificationsCleared());
    } else {
      setNotificationsCleared(false);
    }
  }, [user]);

  // ── Notification actions ─────────────────────────────────────────────────
  async function markAllAsRead() {
    try {
      const response = await api.patch(
        "/api/notification/mark-all-notifications-as-read"
      );
      if (response.data.success) {
        setNotifications([]);
        setNotificationsCleared(true);
      }
    } catch {
      setNotifications([]);
      setNotificationsCleared(true);
    }
  }

  async function markAsRead(notificationId) {
    try {
      const response = await api.patch(
        `/api/notification/mark-notification-as-read/${notificationId}`
      );
      if (response.data.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }

  // ── Fetch notifications ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user || notificationsCleared) return;
    const getNotifications = async () => {
      try {
        const response = await api.get("/api/notification/get-notifications");
        if (response.data.success) {
          setNotifications(response.data.notifications || []);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    getNotifications();
  }, [user, loading, notificationsCleared]);

  // ── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      socket.disconnect();
      return;
    }
    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      if (user?._id || user?.id) socket.emit("join:admin", user._id || user.id);
    };
    const handleNewNotification = (data) => {
      if (notificationsCleared) return;
      const notification = data.notification;
      setNotifications((prev) => [notification, ...prev]);
      if (notification.type === "PAYMENT_NOTIFICATION") {
        toast.success(notification.title, {
          description: notification.message,
          duration: 5000,
        });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("new-notification", handleNewNotification);
    if (socket.connected && (user?._id || user?.id)) {
      socket.emit("join:admin", user._id || user.id);
    }
    return () => {
      socket.off("connect", handleConnect);
      socket.off("new-notification", handleNewNotification);
    };
  }, [user, notificationsCleared]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-wrap sm:flex-nowrap justify-between items-center sm:p-4 w-full gap-4">
      {/* Search bar — hidden on tenants page since it has its own search */}
      {!isTenantsPage && <GlobalSearch />}

      {/* Notification bell */}
      <div className={isTenantsPage ? "ml-auto" : ""}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-10 h-10 rounded-full relative">
              <Bell className="w-5 h-5 text-gray-500" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent>
            <SheetHeader>
              <SheetTitle>Notifications</SheetTitle>
            </SheetHeader>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                className="w-fit ml-auto mr-3 mb-1 border-none text-sm"
                onClick={markAllAsRead}
              >
                Mark All as Read
              </Button>
            )}

            <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto mt-1">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No notifications
                </p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id || notification.id}
                    className="flex items-start gap-3 mb-2 rounded-md border border-gray-200 bg-gray-50 p-3 ml-3 mr-3"
                  >
                    <Bell
                      className={`w-5 h-5 mt-0.5 ${!notification.isRead ? "text-primary-500" : "text-gray-400"
                        }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-black">
                        {notification.title}
                      </p>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                          <AccordionTrigger
                            className="text-sm text-gray-600 mt-1"
                            onClick={() =>
                              markAsRead(notification._id || notification.id)
                            }
                          >
                            View details{" "}
                            {notification.isRead ? "(Read)" : "(Unread)"}
                          </AccordionTrigger>
                          <AccordionContent>
                            {notification.message}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      {notification.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}