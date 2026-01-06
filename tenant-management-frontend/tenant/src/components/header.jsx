import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
export default function Header() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const ADMIN_ID = "694bb354fad15644979f5209"; // replace with your admin ID

    // Connection event handlers
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      // Join the admin room after connection is established
      socket.emit("join:admin", ADMIN_ID);
      console.log("Joined admin room");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Listen for rent overdue notifications
    socket.on("rent:overdue", (notification) => {
      console.log("Overdue Rent Notification:", notification);
      // Add to state
      setNotifications((prev) => [notification, ...prev]);
    });

    // Connect socket
    socket.connect();

    // Cleanup on unmount
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("rent:overdue");
      socket.disconnect();
    };
  }, []);

  return (
    <div className="flex  justify-between items-center p-4 w-full gap-4">
      <div className="relative w-full sm:flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          type="text"
          className="w-full pl-10 h-10 text-sm border-gray-300 rounded-md"
          placeholder="Search name, unit, lease end (YYYY-MM-DD)"
        />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-10 h-10 rounded-full">
            <Bell className="w-5 h-5 text-gray-500" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => (
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-gray-500" />
                <p className="text-sm text-gray-500">{notification.message}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
