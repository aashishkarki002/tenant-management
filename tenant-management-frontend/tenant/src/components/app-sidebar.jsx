import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  FileText,
  Wrench,
  Banknote,
  Zap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import api from "../../plugins/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

// ── Nav groups matching image layout ──────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Property",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Tenants", url: "/tenants", icon: Users },
      { title: "Units", url: "/units", icon: Building2 },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Rent & Payments", url: "/rent-payment", icon: DollarSign },
      { title: "Accounting", url: "/accounting", icon: FileText },
      { title: "Cheque Drafts", url: "/cheque-drafts", icon: Banknote },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Maintenance", url: "/maintenance", icon: Wrench },
      { title: "Electricity", url: "/electricity", icon: Zap },
    ],
  },
];

function getInitials(name) {
  if (!name) return "AD";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const SignOut = async () => {
    try {
      try { await api.post("/api/auth/logout"); } catch (_) { }
      logout();
      navigate("/login");
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      logout();
      navigate("/login");
      toast.success("Signed out successfully");
    }
  };

  const initials = getInitials(user?.name);
  const avatarSrc = user?.profilePicture || undefined;

  return (
    <Sidebar
      variant="sidebar"
      className="bg-white border-r border-slate-100 w-56"
    >
      {/* ── Logo ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-4">
        <img src="/logo.jpeg" alt="Sallyan House" className="w-10 h-10" />
        <span className="text-lg font-bold tracking-tight text-slate-900">Sallyan House</span>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <SidebarContent className="px-3 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {/* Section label — uppercase, muted, tight spacing */}
            <p className="px-2 mb-1 text-[10px] font-semibold tracking-widest uppercase text-slate-400">
              {group.label}
            </p>

            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={handleNav}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                      "border-l-2",
                      isActive
                        ? "border-red-800 bg-red-50 text-red-900"
                        : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={[
                          "w-4 h-4 flex-shrink-0 transition-colors",
                          isActive
                            ? "text-red-800"
                            : "text-slate-400 group-hover:text-slate-600",
                        ].join(" ")}
                      />
                      <span>{item.title}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </SidebarContent>

      {/* ── User footer ─────────────────────────────────────────────── */}
      <SidebarFooter className="p-3 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors focus:outline-none">
              <Avatar className="h-8 w-8 ring-2 ring-slate-100 flex-shrink-0">
                {avatarSrc && (
                  <AvatarImage
                    src={avatarSrc}
                    alt={user?.name ?? "Profile"}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-slate-200 text-slate-600 font-semibold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {user?.name ?? "Admin"}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  {user?.email ?? "admin@gmail.com"}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-44">
            <DropdownMenuItem
              onClick={() => navigate("/admin")}
              className="cursor-pointer"
            >
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={SignOut}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}