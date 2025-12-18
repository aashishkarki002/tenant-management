import { SidebarProvider, SidebarTrigger } from "../ui/sidebar"
import AppSidebar from "../app-sidebar"

export default function AppLayout({ children }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex flex-col flex-1">
          <header className="flex items-center border-b px-4 py-2">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}