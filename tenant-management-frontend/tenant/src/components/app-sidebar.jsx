// src/components/app-sidebar.jsx
import {
  LayoutDashboard,
  Users,
  Building2,
  Wrench,
  Banknote,
  Zap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ClipboardCheck,
  Store,
  DoorOpen,
  UserCog,
  ReceiptText,
  ClipboardList,
  FileText,
  Megaphone,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useNavigate, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import api from "../../plugins/axios";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS as ACCOUNTING_GROUPS, getGroupForTab } from "../Accounts/components/accountingNavConfig";

/* ─── NAV STRUCTURE ─────────────────────────────────────────────────────────
   Industry standard: flatten the nav into uniform groups. No separate
   PRIMARY_ITEMS treatment — Dashboard is just the first item in the first
   group. Uniform item sizing prevents the visual rhythm break.
─────────────────────────────────────────────────────────────────────────── */

const NAV_GROUPS = [
  {
    label: null, // No label for the top-level single item
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Core",
    items: [
      { title: "Buildings", url: "/buildings", icon: Building2 },
      { title: "Units", url: "/units", icon: DoorOpen },
      { title: "Tenants", url: "/tenants", icon: Users },
      { title: "Staff", url: "/staff", icon: UserCog },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Rent & Payments", url: "/rent-payment", icon: Banknote },
      { title: "Accounting", url: "/accounting", icon: ReceiptText },
      { title: "TDS Verification", url: "/tds-verification", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
      { title: "Daily Checks", url: "/admin-daily-checks", icon: ClipboardList, badge: "Today" },
      { title: "Maintenance", url: "/maintenance", icon: Wrench },
      { title: "Broadcasts", url: "/broadcasts", icon: Megaphone },
    ],
  },
  {
    label: "Utilities",
    items: [
      { title: "Electricity", url: "/electricity", icon: Zap },
    ],
  },
  {
    label: "More",
    collapsible: true, // Only this group collapses
    items: [
      { title: "Loans", url: "/loans", icon: Landmark },
      { title: "Cheque Drafts", url: "/cheque-drafts", icon: FileText },
      { title: "Vendors", url: "/vendors", icon: Store },
    ],
  },
];

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

function getInitials(name) {
  if (!name) return "AD";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

/* ─── ACCOUNTING SUB-NAV ────────────────────────────────────────────────── */

function AccountingNav({ activeTab, onTabSelect }) {
  const activeGroupId = getGroupForTab(activeTab);
  const [openGroups, setOpenGroups] = useState(() => new Set([activeGroupId]));

  const toggleGroup = (id) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-0.5">
      {ACCOUNTING_GROUPS.map(group => {
        const isGroupActive = group.id === activeGroupId;
        const isOpen = openGroups.has(group.id);

        return (
          <div key={group.id}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer",
                isGroupActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span className={cn(
                "w-0.5 h-3.5 rounded-full shrink-0 transition-colors",
                isGroupActive ? "bg-sidebar-ring" : "bg-transparent",
              )} />
              <group.Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">{group.label}</span>
              <ChevronRight className={cn(
                "w-3 h-3 shrink-0 transition-transform duration-150",
                isOpen && "rotate-90",
              )} />
            </button>

            {/* Tab items */}
            {isOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5 mb-1">
                {group.tabs.map(tab => {
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabSelect(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-9 pr-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <span className={cn(
                        "w-0.5 h-3 rounded-full shrink-0",
                        isActive ? "bg-sidebar-ring" : "bg-transparent",
                      )} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── NAV ITEM ───────────────────────────────────────────────────────────── */

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.url}
      end={item.end ?? false}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar — consistent across all items */}
          <span
            className={cn(
              "w-0.5 h-3.5 rounded-full shrink-0 transition-colors",
              isActive ? "bg-sidebar-ring" : "bg-transparent"
            )}
          />
          <item.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
          {item.badge && (
            <span className="text-[9px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export default function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [openGroups, setOpenGroups] = useState({});
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAccounting = location.pathname === "/accounting" || location.pathname.startsWith("/accounting/");
  const activeAccountingTab = searchParams.get("tab") ?? "overview";

  const handleAccountingTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
    if (isMobile) setOpenMobile(false);
  };

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const toggleGroup = (label) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const SignOut = async () => {
    try { await api.post("/api/auth/logout"); } catch { /* best-effort logout */ }
    logout();
    navigate("/login");
    toast.success("Signed out successfully");
  };

  const initials = getInitials(user?.name);
  const avatarSrc = user?.profilePicture || undefined;

  return (
    /*
      FIX: --sidebar-width is now set on SidebarProvider in AppLayout.
      Do NOT set it here — it would be scoped to the sidebar element only
      and not readable by the header separator in AppLayout.
    */
    <Sidebar className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <SidebarRail />

      {/* ── BRAND ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-sidebar-border shrink-0">
        <img
          src="/logo.jpeg"
          alt="Sallyan House"
          className="w-7 h-7 rounded-md object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight">
            Sallyan House
          </p>
          <p className="text-[10px] uppercase tracking-[0.22em] opacity-50 leading-tight">
            Management
          </p>
        </div>
      </div>

      {/* ── NAVIGATION ─────────────────────────────────────────────────── */}
      <SidebarContent className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-1">

        {isAccounting ? (
          <>
            {/* Back to main nav */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-md text-[12px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              <span>All sections</span>
            </button>
            <p
              className="px-2.5 mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: "var(--sidebar-foreground, currentColor)", opacity: 0.5 }}
            >
              Accounting
            </p>
            <AccountingNav
              activeTab={activeAccountingTab}
              onTabSelect={handleAccountingTab}
            />
          </>
        ) : (
          NAV_GROUPS.map((group, gi) => {
            const isCollapsible = group.collapsible;
            const isOpen = openGroups[group.label] ?? false;

            return (
              <div key={group.label ?? `group-${gi}`} className={gi > 0 ? "mt-3" : ""}>
                {group.label && (
                  isCollapsible ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2.5 mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors"
                      style={{ color: "var(--sidebar-foreground, currentColor)", opacity: 0.5 }}
                    >
                      <span>{group.label}</span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                  ) : (
                    <p
                      className="px-2.5 mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
                      style={{ color: "var(--sidebar-foreground, currentColor)", opacity: 0.5 }}
                    >
                      {group.label}
                    </p>
                  )
                )}
                <nav className={cn(
                  "flex flex-col gap-0.5",
                  isCollapsible && "overflow-hidden transition-all duration-200",
                  isCollapsible && (isOpen ? "max-h-96" : "max-h-0"),
                )}>
                  {group.items.map((item) => (
                    <NavItem key={item.title} item={item} onClick={handleNav} />
                  ))}
                </nav>
              </div>
            );
          })
        )}

      </SidebarContent>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <SidebarFooter className="p-3 border-t border-sidebar-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-6 w-6 shrink-0">
                {avatarSrc && (
                  <AvatarImage src={avatarSrc} alt={user?.name ?? "Profile"} />
                )}
                <AvatarFallback className="text-[10px] font-semibold bg-sidebar-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
                <span className="text-[12px] font-medium truncate">
                  {user?.name ?? "Admin"}
                </span>
                <span className="text-[11px] truncate" style={{ opacity: 0.5 }}>
                  {user?.email ?? "admin@sallyanhouse.com"}
                </span>
              </div>

              <ChevronDown className="w-3 h-3 shrink-0" style={{ opacity: 0.5 }} />
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
                isDark ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-600"
              )}>
                {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                {isDark ? "Dark" : "Light"}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={SignOut} className="text-destructive">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}