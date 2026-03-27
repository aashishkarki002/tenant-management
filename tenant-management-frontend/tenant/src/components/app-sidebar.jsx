import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  FileText,
  Wrench,
  Banknote,
  Zap,
  ChevronDown,
  Landmark,
  ClipboardCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "../context/ThemeContext";
import { Button } from "@/components/ui/button";

import {
  Sun, Moon,
} from "lucide-react";
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
import api from "../../plugins/axios";
import { useState } from "react";
import { cn } from "@/lib/utils";

/* ================= NAV STRUCTURE ================= */

const PRIMARY_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { title: "Buildings", url: "/buildings", icon: Building2 },
      { title: "Units", url: "/units", icon: Building2 },
      { title: "Tenants", url: "/tenants", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Rent & Payments", url: "/rent-payment", icon: DollarSign },
      { title: "Accounting", url: "/accounting", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Daily Checks",
        url: "/admin-daily-checks",
        icon: ClipboardCheck,
        highlight: true,
      },
      { title: "Maintenance", url: "/maintenance", icon: Wrench },
    ],
  },
  {
    label: "Utilities",
    items: [{ title: "Electricity", url: "/electricity", icon: Zap }],
  },
];

const MORE_GROUP = {
  label: "More",
  items: [
    { title: "Loans", url: "/loans", icon: Landmark },
    { title: "Cheque Drafts", url: "/cheque-drafts", icon: Banknote },
  ],
};

/* ================= HELPERS ================= */

function getInitials(name) {
  if (!name) return "AD";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

/* ================= COMPONENT ================= */

export default function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const iconBtnBase = "size-7 p-0 rounded-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";
  const iconBtnStyle = { color: "var(--color-text-sub)" };

  const [moreOpen, setMoreOpen] = useState(false);

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const SignOut = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (_) { }

    logout();
    navigate("/login");
    toast.success("Signed out successfully");
  };

  const initials = getInitials(user?.name);
  const avatarSrc = user?.profilePicture || undefined;

  return (
    <Sidebar className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <SidebarRail />

      {/* ================= BRAND ================= */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <img
          src="/logo.jpeg"
          alt="Sallyan House"
          className="w-7 h-7 rounded-md object-contain shrink-0"
        />

        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate">
            Sallyan House
          </p>
          <p className="text-[10px] uppercase tracking-[0.22em] opacity-60">
            Management
          </p>
        </div>
      </div>

      {/* ================= NAVIGATION ================= */}
      <SidebarContent className="flex-1 overflow-y-auto py-3 px-3 space-y-4">

        {/* Primary Items (No Group Label) */}
        <nav className="flex flex-col gap-1">
          {PRIMARY_ITEMS.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              onClick={handleNav}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`w-0.5 h-4 rounded-full ${isActive ? "bg-sidebar-ring" : "bg-transparent"
                      }`}
                  />
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Grouped Navigation */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p
              className={`px-2 mb-1.5 text-[9px] font-medium tracking-[0.24em] uppercase ${group.label === "Finance" ? "text-primary" : "opacity-60"
                }`}
            >
              {group.label}
            </p>

            <nav className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={handleNav}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`w-0.5 h-4 rounded-full ${isActive ? "bg-sidebar-ring" : "bg-transparent"
                          }`}
                      />
                      <item.icon className="w-3.5 h-3.5 shrink-0" />

                      <span className="flex items-center gap-2">
                        {item.title}

                        {/* Highlight Daily Checks */}
                        {item.highlight && (
                          <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">
                            Today
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        {/* ================= MORE (COLLAPSIBLE) ================= */}
        <div>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="w-full flex items-center justify-between px-2 mb-1.5 text-[9px] font-medium tracking-[0.24em] uppercase opacity-60"
          >
            More
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ${moreOpen ? "max-h-40" : "max-h-0"
              }`}
          >
            <nav className="flex flex-col gap-1 mt-1">
              {MORE_GROUP.items.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  onClick={handleNav}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")
                  }
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </SidebarContent>

      {/* ================= FOOTER ================= */}
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-sidebar-accent transition">
              <Avatar className="h-7 w-7 shrink-0">
                {avatarSrc && (
                  <AvatarImage src={avatarSrc} alt={user?.name ?? "Profile"} />
                )}
                <AvatarFallback className="text-[11px] font-semibold bg-sidebar-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
                <span className="text-[13px] font-medium truncate">
                  {user?.name ?? "Admin"}
                </span>
                <span className="text-[11px] opacity-60 truncate">
                  {user?.email ?? "admin@sallyanhouse.com"}
                </span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-44">
            <DropdownMenuItem
              onClick={toggleTheme}
              className="flex items-center justify-between gap-3 cursor-pointer"
            >
              <span className="text-sm">Appearance</span>
              <div className={cn(
                "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-colors",
                isDark
                  ? "bg-zinc-700 text-zinc-200"
                  : "bg-zinc-100 text-zinc-600"
              )}>
                {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                {isDark ? "Dark" : "Light"}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={SignOut}
              className="text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}