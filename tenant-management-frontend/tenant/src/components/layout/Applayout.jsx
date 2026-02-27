// src/components/layout/AppLayout.jsx
import { useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from "../ui/sidebar";
import AppSidebar from "../app-sidebar";
import Header, { PushNotificationBanner } from "../header/Header";
import { useAuth } from "../context/AuthContext";

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
            {/*
              Header bar: sidebar trigger + search + bell icon.
              PushNotificationBanner is NOT inside this flex row — it sits
              below it so it takes its own full-width strip and never
              competes with the bell for space.
            */}
            <header className="flex items-center border-b sm:px-4 shrink-0">
              <SidebarTrigger />
              <Header />
            </header>

            {/*
              Push banner: only visible when action is needed (not subscribed,
              not dismissed, permission not granted). Renders as its own row.
            */}
            <PushNotificationBanner user={user} />
          </>
        )}

        {/* Tenants page: no header bar, sidebar trigger floats over content */}
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