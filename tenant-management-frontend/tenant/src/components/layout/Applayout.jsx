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
import PushNotificationBanner from "../PushNotificationBanner";

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  return (
    <ThemeProvider>
      <HeaderSlotProvider>
        {/*
          FIX: --sidebar-width must live on SidebarProvider, not on <Sidebar>.
          SidebarProvider writes this var to :root; any child reading
          w-[--sidebar-width] (e.g. the header separator) will now track it
          correctly. Previously Sidebar set 220px but Provider defaulted to
          240px → 20px misalignment = the visible "gap".
        */}
        <SidebarProvider style={{ "--sidebar-width": "220px" }}>
          {isAdmin ? <AppSidebar /> : <StaffSidebar />}

          <SidebarInset className="relative flex flex-col h-screen bg-background overflow-hidden">

            <header
              className="z-40 flex items-center shrink-0 border-b border-border bg-card"
              style={{ height: "57px" }}
            >
              {/*
                This wrapper mirrors the sidebar width exactly so the
                SidebarTrigger sits flush over the sidebar's right border.
                transition-[width] matches shadcn's collapse animation timing.
              */}
              <div
                className="flex items-center justify-center self-stretch shrink-0 border-r border-border
                           w-[--sidebar-width] transition-[width] duration-200 ease-linear"
              >
                <SidebarTrigger
                  className="w-7 h-7 rounded-md flex items-center justify-center
                             hover:bg-sidebar-accent text-muted-foreground
                             hover:text-foreground transition-all"
                />
              </div>

              {/* Header content */}
              <div className="flex-1 min-w-0 overflow-hidden px-4">
                <Header />
              </div>
            </header>

            <PushNotificationBanner />

            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="w-full">
                {children}
              </div>
            </main>

          </SidebarInset>
        </SidebarProvider>
      </HeaderSlotProvider>
    </ThemeProvider>
  );
}