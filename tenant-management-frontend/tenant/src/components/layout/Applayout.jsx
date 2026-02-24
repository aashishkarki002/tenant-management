import { useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from "../ui/sidebar";
import AppSidebar from "../app-sidebar";
import Header from "../header";
import PushNotificationBanner from "../PushNotificationBanner";

export default function AppLayout({ children }) {
  const { pathname } = useLocation();

  // Hide the full header bar only on the tenants page
  const hideHeader = pathname === "/tenants";

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarRail />
      <SidebarInset className="relative">
        {!hideHeader && (
          <header className="flex items-center border-b sm:px-4">
            <SidebarTrigger />
            <Header />
            <PushNotificationBanner />
          </header>
        )}

        {/* On tenants page: sidebar trigger floats over content, no space taken */}
        {hideHeader && (
          <div className="absolute top-3 left-3 z-40">
            <SidebarTrigger />
          </div>
        )}

        <main className="flex-1 p-4 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}