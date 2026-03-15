/**
 * StaffSidebar.jsx
 *
 * Petrol-themed sidebar for staff users.
 *
 * Language:
 *  - All user-facing strings come from react-i18next (useTranslation)
 *  - LanguageToggle (pill variant) is embedded in the footer above the
 *    profile card so staff can switch locale at any time without leaving
 *    the current page.
 *  - Nav item labels use translation keys so they render in the active locale.
 */

import { Wrench, Zap, Users, LayoutDashboard, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import LanguageToggle from "@/components/language-toggle";

// ─── Nav items ────────────────────────────────────────────────────────────────
// `labelKey` maps to dashboard.link* keys defined in i18n.js.
// Daily Check is promoted to slot #2 — it's the staff member's primary daily action.

const STAFF_ITEMS = [
    { labelKey: "dashboard.linkDashboard", url: "/", icon: LayoutDashboard },
    { labelKey: "dashboard.linkDailyCheck", url: "/checklists", icon: ClipboardList },
    { labelKey: "dashboard.linkMaintenance", url: "/maintenance", icon: Wrench },
    { labelKey: "dashboard.linkGenerator", url: "/maintenance/generator", icon: Wrench },
    { labelKey: "dashboard.linkElectricity", url: "/electricity", icon: Zap },
    { labelKey: "sidebar.tenants", url: "/tenants", icon: Users },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
    if (!name) return "ST";
    return name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join("");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffSidebar() {
    const { isMobile, setOpenMobile } = useSidebar();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { t } = useTranslation();

    const handleNav = () => {
        if (isMobile) setOpenMobile(false);
    };

    const signOut = async () => {
        try {
            logout();
            navigate("/login");
            toast.success(t("sidebar.signedOut", "Signed out successfully"));
        } catch {
            logout();
            navigate("/login");
        }
    };

    const initials = getInitials(user?.name);
    const avatarSrc = user?.profilePicture || undefined;

    return (
        <Sidebar
            variant="sidebar"
            className="bg-[var(--color-surface)] border-r border-[var(--color-border)]"
        >
            <SidebarContent>
                <SidebarGroup>

                    {/* ── Brand ─────────────────────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-4 mt-6 mb-1">
                        <span className="text-xl font-bold text-[var(--color-text-strong)]">
                            EasyManage
                        </span>
                        {/* Icon-only toggle sits next to the wordmark — compact, always reachable */}
                        <LanguageToggle variant="icon" />
                    </div>

                    <Separator className="w-full h-px bg-[var(--color-border)] my-2" />

                    {/* ── Section label ──────────────────────────────────────────────── */}
                    <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-weak)] uppercase tracking-widest px-4 mb-1">
                        {t("dashboard.portalLabel")}
                    </SidebarGroupLabel>

                    {/* ── Nav items ──────────────────────────────────────────────────── */}
                    <SidebarGroupContent className="p-3">
                        <SidebarMenu>
                            {STAFF_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.url} className="mb-1">
                                    <SidebarMenuButton asChild className="rounded-xl p-0">
                                        <NavLink
                                            to={item.url}
                                            end={item.url === "/"}
                                            onClick={handleNav}
                                            className={({ isActive }) =>
                                                [
                                                    "flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-colors font-medium",
                                                    isActive
                                                        ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] border-l-[3px] border-[var(--color-accent)] font-semibold"
                                                        : "text-[var(--color-text-sub)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]",
                                                ].join(" ")
                                            }
                                        >
                                            <item.icon className="w-4 h-4 shrink-0" />
                                            {/* t() with a fallback so nav never renders blank if a key is missing */}
                                            <span>{t(item.labelKey, item.labelKey.split(".").pop())}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>

                </SidebarGroup>
            </SidebarContent>

            {/* ── Footer ─────────────────────────────────────────────────────────── */}
            <SidebarFooter className="p-3 space-y-2">

                {/* Language toggle — pill variant, full-width strip */}
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-[var(--color-text-weak)] uppercase tracking-widest">
                        {t("sidebar.language", "Language")}
                    </span>
                    <LanguageToggle variant="pill" />
                </div>

                <Separator className="bg-[var(--color-border)]" />

                {/* Profile card / sign-out dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-2xl">
                            <div className="
                w-full flex items-center gap-3 px-3 py-3 rounded-2xl
                border border-[var(--color-border)] bg-[var(--color-surface-raised)]
                hover:bg-[var(--color-accent-light)] transition-colors
              ">
                                <Avatar className="h-9 w-9 ring-2 ring-[var(--color-border)] shrink-0">
                                    {avatarSrc && (
                                        <AvatarImage
                                            src={avatarSrc}
                                            alt={user?.name ?? "Staff"}
                                            className="object-cover"
                                        />
                                    )}
                                    <AvatarFallback className="bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold text-sm">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex flex-col text-left leading-tight min-w-0">
                                    <span className="font-semibold text-sm text-[var(--color-text-strong)] truncate max-w-[130px]">
                                        {user?.name ?? t("sidebar.staff", "Staff")}
                                    </span>
                                    <span className="text-xs text-[var(--color-text-weak)] truncate max-w-[130px]">
                                        {user?.email ?? ""}
                                    </span>
                                    <span className="text-xs text-[var(--color-accent)] font-medium capitalize mt-0.5">
                                        {user?.role ?? "staff"}
                                    </span>
                                </div>
                            </div>
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent side="top" align="start" className="w-44">
                        <DropdownMenuItem
                            onClick={() => navigate("/admin")}
                            className="cursor-pointer text-[var(--color-text-body)]"
                        >
                            {t("sidebar.myProfile", "My Profile")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={signOut}
                            className="cursor-pointer text-[var(--color-danger)] focus:text-[var(--color-danger)]"
                        >
                            {t("sidebar.signOut", "Sign out")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </SidebarFooter>
        </Sidebar>
    );
}