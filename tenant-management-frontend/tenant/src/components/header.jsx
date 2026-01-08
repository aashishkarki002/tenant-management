import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { socket } from "../../plugins/socket";
import { useEffect } from "react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../context/AuthContext";
import api from "../../plugins/axios";

export default function Header() {
  const [notifications, setNotifications] = useState([]);
  const isMobile = useIsMobile();
  const { user, loading } = useAuth();

  // Fetch notifications when user is loaded
  useEffect(() => {
    if (loading || !user) return;

    const getNotifications = async () => {
      try {
        // The backend uses the authenticated user's ID from the token, so we don't need to pass it in the URL
        const response = await api.get("/api/notification/get-notifications/0");
        if (response.data.success) {
          setNotifications(response.data.notifications || []);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
        // Don't show error toast - notifications are not critical
      }
    };

    getNotifications();
  }, [user, loading]);

  // Connect socket and listen for new notifications
  useEffect(() => {
    if (!user) {
      socket.disconnect();
      return;
    }

    // Connect socket if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    // Join admin room when connected
    const handleConnect = () => {
      if (user?._id || user?.id) {
        socket.emit("join:admin", user._id || user.id);
      }
    };

    // Handle new notifications
    const handleNewNotification = (data) => {
      setNotifications((prev) => [data.notification, ...prev]);
    };

    socket.on("connect", handleConnect);
    socket.on("new-notification", handleNewNotification);

    // Join room immediately if already connected
    if (socket.connected && (user?._id || user?.id)) {
      socket.emit("join:admin", user._id || user.id);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("new-notification", handleNewNotification);
    };
  }, [user]);
  return (
    <div className="flex flex-wrap sm:flex-nowrap justify-between items-center  sm:p-4 w-full gap-4">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          type="text"
          className="w-full sm:pl-10 pl-4 h-10 text-sm border-gray-300 rounded-md"
          placeholder={
            isMobile ? "Search..." : "Search name, unit, lease end (YYYY-MM-DD)"
          }
        />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-10 h-10 rounded-full relative">
            <Bell className="w-5 h-5 text-gray-500" />
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {notifications.filter((n) => !n.isRead).length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-4">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No notifications
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id || notification.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    !notification.isRead
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <Bell
                    className={`w-5 h-5 mt-0.5 ${
                      !notification.isRead ? "text-blue-500" : "text-gray-400"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
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
  );
}
