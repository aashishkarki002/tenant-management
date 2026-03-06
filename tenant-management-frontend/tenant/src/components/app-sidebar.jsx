import {
  LayoutDashboard, Users, Building2, DollarSign,
  FileText, Wrench, Banknote, Zap, ChevronDown,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import api from "../../plugins/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

// ── Nav — owner's mental model: People → Money → Building ────────────────────
const NAV_GROUPS = [
  {
    label: "People",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Tenants", url: "/tenants", icon: Users },
      { title: "Units", url: "/units", icon: Building2 },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Rent & Payments", url: "/rent-payment", icon: DollarSign },
      { title: "Accounting", url: "/accounting", icon: FileText },
      { title: "Cheque Drafts", url: "/cheque-drafts", icon: Banknote },
    ],
  },
  {
    label: "Building",
    items: [
      { title: "Maintenance", url: "/maintenance", icon: Wrench },
      { title: "Electricity", url: "/electricity", icon: Zap },
    ],
  },
];

function getInitials(name) {
  if (!name) return "AD";
  return name.split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");
}

export default function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleNav = () => { if (isMobile) setOpenMobile(false); };

  const SignOut = async () => {
    try { await api.post("/api/auth/logout"); } catch (_) { }
    logout();
    navigate("/login");
    toast.success("Signed out successfully");
  };

  const initials = getInitials(user?.name);
  const avatarSrc = user?.profilePicture || undefined;

  return (
    <Sidebar variant="sidebar" className="w-56 border-r-0">
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 pt-5 pb-5 border-b"
        style={{ background: "#3D1414", borderBottomColor: "#521C1C" }}
      >
        <img
          src="/logo.jpeg"
          alt="Sallyan House"
          className="w-8 h-8 rounded-md object-contain bg-white/10 p-0.5 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-tight leading-none truncate"
            style={{ color: "#F0DADA" }}>
            Sallyan House
          </p>
          <p className="text-[10px] tracking-[0.15em] uppercase mt-0.5"
            style={{ color: "#C47272" }}>
            Management
          </p>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <SidebarContent
        className="flex-1 overflow-y-auto py-4 px-3 space-y-5"
        style={{ background: "#3D1414" }}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[9px] font-semibold tracking-[0.25em] uppercase"
              style={{ color: "#8B3030" }}>
              {group.label}
            </p>
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={handleNav}
                  className={({ isActive }) => [
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/10 text-[#F0DADA] shadow-sm"
                      : "text-[#C47272] hover:bg-white/5 hover:text-[#F0DADA]",
                  ].join(" ")}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active: left accent bar */}
                      <span className={`w-0.5 h-4 rounded-full shrink-0 transition-all ${isActive ? "bg-[#DDA8A8]" : "bg-transparent group-hover:bg-[#8B3030]"
                        }`} />
                      <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#F0DADA]" : "text-[#8B3030] group-hover:text-[#C47272]"
                        }`} />
                      <span>{item.title}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </SidebarContent>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <SidebarFooter
        className="p-3 border-t"
        style={{ background: "#2C0F0F", borderTopColor: "#521C1C" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                               hover:bg-white/5 transition-colors focus:outline-none group">
              <Avatar className="h-7 w-7 shrink-0 ring-1" style={{ ringColor: "#521C1C" }}>
                {avatarSrc && (
                  <AvatarImage src={avatarSrc} alt={user?.name ?? "Profile"} className="object-cover" />
                )}
                <AvatarFallback
                  className="text-[11px] font-bold"
                  style={{ background: "#521C1C", color: "#F0DADA" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
                <span className="text-[13px] font-semibold truncate" style={{ color: "#F0DADA" }}>
                  {user?.name ?? "Admin"}
                </span>
                <span className="text-[11px] truncate" style={{ color: "#8B3030" }}>
                  {user?.email ?? "admin@sallyanhouse.com"}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
                style={{ color: "#C47272" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-44 border-[#DDD6D0]">
            <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer text-[#3D1414] focus:bg-[#F8F5F2] focus:text-[#3D1414]">
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={SignOut} className="cursor-pointer text-[#B02020] focus:text-[#B02020] focus:bg-[#F5D5D5]">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}