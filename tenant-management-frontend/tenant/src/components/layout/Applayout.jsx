import { SidebarProvider, SidebarTrigger, SidebarInset, SidebarRail } from "../ui/sidebar"
import AppSidebar from "../app-sidebar"

export default function AppLayout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarRail />
      <SidebarInset>
        <header className="flex items-center border-b px-4 py-2">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}