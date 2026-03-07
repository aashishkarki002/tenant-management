// src/components/layout/AppLayout.jsx
import {
  SidebarProvider, SidebarTrigger, SidebarInset, SidebarRail,
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

        <SidebarInset className="relative flex flex-col min-h-screen bg-[#F8F5F2]">

          {/* ── Top bar — brand-matched to sidebar ──────────────────────── */}
          <header
            className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-l"
            style={{
              background: "white",
              borderColor: "#DDD6D0",
            }}
          >
            {/* Sidebar toggle — mt-1 keeps it optically aligned to top row */}
            <SidebarTrigger
              className="w-8 h-8 rounded-md flex items-center justify-center
             border border-[#DDD6D0] bg-white hover:bg-[#F8F5F2]
             text-[#948472] hover:text-[#3D1414] transition-all shrink-0"
            />

            {/* Thin brand accent rule between trigger and content */}
            <div className="w-px h-5 mt-1.5 sm:mt-0 shrink-0" style={{ background: "#EEE9E5" }} />

            <Header />
          </header>

          {/* ── Push notification banner — below header, above content ─── */}
          <PushNotificationBanner user={user} />

          {/* ── Page content ─────────────────────────────────────────────── */}
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-6xl w-full px-4 py-4">
              {children}
            </div>
          </main>

        </SidebarInset>
      </SidebarProvider>
    </HeaderSlotProvider>
  );
}