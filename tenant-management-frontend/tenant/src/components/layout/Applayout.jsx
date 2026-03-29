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

          <SidebarInset className="relative flex flex-col h-screen bg-background overflow-hidden">

            <header
              className="z-40 flex items-center shrink-0 border-b border-border bg-card"
              style={{ height: "57px" }}
            >
              {/*
                KEY FIX: w-[--sidebar-width] makes this wrapper exactly as wide
                as the sidebar — no hardcoding, it just tracks the CSS variable
                that SidebarProvider sets on :root. The border-r then lands
                perfectly on top of the sidebar's right border.

                When the sidebar collapses, --sidebar-width changes automatically
                and the separator follows with the same ease-linear transition
                that shadcn uses internally for the sidebar animation.
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