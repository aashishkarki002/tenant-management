// src/components/layout/AppLayout.jsx
import {
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "../ui/sidebar";
import AppSidebar from "../app-sidebar";
import StaffSidebar from "../staff-sidebar";
import Header from "../header";
import { useAuth } from "../../context/AuthContext";
import { HeaderSlotProvider } from "../../context/HeaderSlotContext";
import { ThemeProvider } from "../../context/ThemeContext";

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  return (
    <ThemeProvider>
      <HeaderSlotProvider>
        <SidebarProvider>
          {isAdmin ? <AppSidebar /> : <StaffSidebar />}

          <SidebarInset className="relative flex flex-col min-h-screen bg-background overflow-x-hidden">

            {/* ── Top bar — sticky, minimal ── */}
            <header
              className="sticky top-0 z-40 flex items-center gap-3 px-4 min-h-14 shrink-0
                        border-b border-border bg-card/95 overflow-hidden
                        backdrop-blur supports-[backdrop-filter]:bg-card/80"
            >
              {/* Sidebar toggle — pinned to top so it stays aligned with sidebar logo row */}
              <SidebarTrigger
                className="w-8 h-8 rounded-md flex items-center justify-center self-start mt-3
                         border border-border bg-card
                         hover:bg-secondary text-accent
                         hover:text-primary transition-all shrink-0"
              />

              {/* Vertical divider — full height so it always lines up with sidebar's right border */}
              <div className="self-stretch w-px shrink-0 bg-border" />

              {/* Header fills remaining space; its toolbar scrolls internally */}
              <div className="flex-1 min-w-0 overflow-hidden py-2.5">
                <Header />
              </div>
            </header>

            {/* ── Page content ── */}
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-6xl w-full px-4 py-4">
                {children}
              </div>
            </main>

          </SidebarInset>
        </SidebarProvider>
      </HeaderSlotProvider>
    </ThemeProvider>
  );
}