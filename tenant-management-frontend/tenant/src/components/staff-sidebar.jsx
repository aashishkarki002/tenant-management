// src/components/staff-sidebar.jsx
import { Wrench, Zap, LayoutDashboard, ClipboardList } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LanguageToggle from "@/components/language-toggle";

/* ─── NAV STRUCTURE ──────────────────────────────────────────────────────────
   Staff nav is intentionally flat — no collapsible groups needed at this
   scope. One label group makes the portal context clear without over-
   engineering a 5-item list.
────────────────────────────────────────────────────────────────────────────── */

const STAFF_GROUPS = [
    {
        label: null,
        items: [
            { labelKey: "dashboard.linkDashboard", url: "/", icon: LayoutDashboard, end: true },
        ],
    },
    {
        label: "portal.label", // i18n key — falls back to "Staff Portal"
        labelFallback: "Staff Portal",
        items: [
            { labelKey: "dashboard.linkDailyCheck", url: "/checklists", icon: ClipboardList, badge: "Today" },
            { labelKey: "dashboard.linkMaintenance", url: "/maintenance", icon: Wrench },
            { labelKey: "dashboard.linkGenerator", url: "/maintenance/generator", icon: Wrench },
            { labelKey: "dashboard.linkElectricity", url: "/electricity", icon: Zap },
        ],
    },
];

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */

function getInitials(name) {
    if (!name) return "ST";
    return name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join("");
}

/* ─── NAV ITEM ───────────────────────────────────────────────────────────────
   Identical pattern to AppSidebar's NavItem:
   • Indicator bar  — w-0.5 h-3.5 rounded-full, bg-sidebar-ring when active
   • Icon           — w-3.5 h-3.5
   • Label          — text-[13px] font-medium, i18n-aware
   • Badge          — same green pill shape
────────────────────────────────────────────────────────────────────────────── */

function NavItem({ item, onClick, t }) {
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
                    {/* Active indicator bar */}
                    <span
                        className={cn(
                            "w-0.5 h-3.5 rounded-full shrink-0 transition-colors",
                            isActive ? "bg-sidebar-ring" : "bg-transparent"
                        )}
                    />
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 truncate">
                        {t(item.labelKey, item.labelKey.split(".").pop())}
                    </span>
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

export default function StaffSidebar() {
    const { isMobile, setOpenMobile } = useSidebar();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { t } = useTranslation();

    const handleNav = () => {
        if (isMobile) setOpenMobile(false);
    };

    const signOut = () => {
        logout();
        navigate("/login");
        toast.success(t("sidebar.signedOut", "Signed out successfully"));
    };

    const initials = getInitials(user?.name);
    const avatarSrc = user?.profilePicture || undefined;

    return (
        <Sidebar className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <SidebarRail />

            {/* ── BRAND ──────────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-3 py-3 border-b border-sidebar-border shrink-0">
                <img
                    src="/logo.jpeg"
                    alt="Sallyan House"
                    className="w-7 h-7 rounded-md object-contain shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate leading-tight">
                        Sallyan House
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] opacity-50 leading-tight">
                        Staff Portal
                    </p>
                </div>
                <LanguageToggle variant="icon" />
            </div>

            {/* ── NAVIGATION ─────────────────────────────────────────────────────── */}
            <SidebarContent className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-1">

                {STAFF_GROUPS.map((group, gi) => (
                    <div key={group.label ?? `group-${gi}`} className={gi > 0 ? "mt-3" : ""}>

                        {/* Group label — same 10px / 0.16em / 50% opacity as app-sidebar */}
                        {group.label && (
                            <p
                                className="px-2.5 mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
                                style={{ color: "var(--sidebar-foreground, currentColor)", opacity: 0.5 }}
                            >
                                {t(group.label, group.labelFallback)}
                            </p>
                        )}

                        <nav className="flex flex-col gap-0.5">
                            {group.items.map((item) => (
                                <NavItem key={item.url} item={item} onClick={handleNav} t={t} />
                            ))}
                        </nav>
                    </div>
                ))}

            </SidebarContent>

            {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
            <SidebarFooter className="p-3 border-t border-sidebar-border shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
                            <Avatar className="h-6 w-6 shrink-0">
                                {avatarSrc && (
                                    <AvatarImage src={avatarSrc} alt={user?.name ?? "Staff"} />
                                )}
                                <AvatarFallback className="text-[10px] font-semibold bg-sidebar-accent">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
                                <span className="text-[12px] font-medium truncate">
                                    {user?.name ?? t("sidebar.staff", "Staff")}
                                </span>
                                <span className="text-[11px] truncate capitalize" style={{ opacity: 0.5 }}>
                                    {user?.role ?? "staff"}
                                </span>
                            </div>

                            <ChevronDown className="w-3 h-3 shrink-0" style={{ opacity: 0.5 }} />
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent side="top" align="start" className="w-48">
                        {/* Language toggle lives here as a non-destructive secondary action */}
                        <DropdownMenuItem asChild className="cursor-pointer p-0">
                            <div className="flex items-center justify-between px-2 py-1.5">
                                <span className="text-sm">{t("sidebar.language", "Language")}</span>
                                <LanguageToggle variant="pill" />
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => navigate("/profile")}
                            className="cursor-pointer"
                        >
                            {t("sidebar.myProfile", "My Profile")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                            {t("sidebar.signOut", "Sign out")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    );
}