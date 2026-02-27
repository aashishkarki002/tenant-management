// src/components/layout/AppLayout.jsx
import { useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from "../ui/sidebar";
import AppSidebar from "../app-sidebar";
import Header from "../header";
import { PushNotificationBanner } from "../header";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout({ children }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const hideHeader = pathname === "/tenants";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarRail />

      <SidebarInset className="relative flex flex-col min-h-screen">
        {!hideHeader && (
          <>
            {/* ── Top bar: sidebar trigger + search + bell ─────────────────── */}
            <header className="flex items-center border-b sm:px-4 shrink-0">
              <SidebarTrigger />
              <Header />
            </header>

            {/* ── Push banner: full-width strip BELOW the header bar ───────── */}
            {/* Rendered outside the header flex row so it never competes with  */}
            {/* the bell icon for space. Only visible when action is needed.     */}
            <PushNotificationBanner user={user} />
          </>
        )}

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