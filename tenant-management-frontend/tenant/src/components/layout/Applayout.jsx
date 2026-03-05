// src/components/layout/AppLayout.jsx
import { useLocation } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from "../ui/sidebar";
import AppSidebar from "../app-sidebar";
import StaffSidebar from "../staff-sidebar";
import { PushNotificationBanner } from "../header";
import Header from "../header";
import { useAuth } from "../../context/AuthContext";
import { HeaderSlotProvider } from "../../context/HeaderSlotContext";

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  return (
    <HeaderSlotProvider>
      <SidebarProvider>
        {isAdmin ? <AppSidebar /> : <StaffSidebar />}
        <SidebarRail />

        <SidebarInset className="relative flex flex-col min-h-screen">
          {/*
            border-b  → separates this header row from the page content below
            border-l  → aligns exactly with the sidebar's right edge (border-r on Sidebar)
            Both borders must live here — on the full-width wrapper that spans
            from the sidebar edge to the viewport edge — NOT inside <Header />,
            where the SidebarTrigger offset would misalign them.
          */}
          <header className="flex items-center gap-2 bg-white px-3 h-14 shrink-0 border-b border-l border-gray-200">
            <SidebarTrigger />
            <Header />
          </header>

          <PushNotificationBanner user={user} />

          <main className="flex-1 p-4 overflow-x-hidden">
            <div className="mx-auto max-w-6xl w-full">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </HeaderSlotProvider>
  );
}