import { Wrench, Zap, Users, LayoutDashboard } from "lucide-react";

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
import { Card, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

// Staff can only access these panels
const staffItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Tenants", url: "/tenants", icon: Users },
    { title: "Maintenance", url: "/maintenance", icon: Wrench },
    { title: "Generator", url: "/maintenance/generator", icon: Wrench },
    { title: "Electricity", url: "/electricity", icon: Zap },
];

function getInitials(name) {
    if (!name) return "ST";
    return name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join("");
}

export default function StaffSidebar() {
    const { isMobile, setOpenMobile } = useSidebar();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleNav = () => {
        if (isMobile) setOpenMobile(false);
    };

    const SignOut = async () => {
        try {
            logout();
            navigate("/login");
            toast.success("Signed out successfully");
        } catch (error) {
            console.error("Sign out error:", error);
            logout();
            navigate("/login");
        }
    };

    const initials = getInitials(user?.name);
    const avatarSrc = user?.profilePicture || undefined;

    return (
        <Sidebar
            variant="sidebar"
            className="bg-white border-r border-slate-200 shadow-sm"
        >
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xl font-bold ml-4 md:ml-10 mt-6 text-black">
                        EasyManage
                    </SidebarGroupLabel>
                    <Separator className="w-full h-px md:h-1 bg-gray-200 my-2" />
                    <SidebarGroupLabel className="text-gray-500 font-bold text-xl">
                        Staff Menu
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="p-3">
                        <SidebarMenu>
                            {staffItems.map((item) => (
                                <SidebarMenuItem key={item.title} className="mb-2 text-gray-500">
                                    <SidebarMenuButton
                                        asChild
                                        className="rounded-md"
                                    >
                                        <NavLink
                                            to={item.url}
                                            onClick={handleNav}
                                            className={({ isActive }) =>
                                                [
                                                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                                                    isActive
                                                        ? "bg-slate-900 text-white"
                                                        : "text-gray-600 hover:bg-slate-100 hover:text-slate-900",
                                                ].join(" ")
                                            }
                                        >
                                            <item.icon className="w-5 h-5" />
                                            <span>{item.title}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full focus:outline-none">
                            <Card className="w-full bg-gray-50 hover:bg-gray-200 transition-colors">
                                <CardHeader className="flex flex-row items-center gap-3 p-2 md:flex-col md:items-center md:p-3">
                                    <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                                        {avatarSrc && (
                                            <AvatarImage
                                                src={avatarSrc}
                                                alt={user?.name ?? "Profile"}
                                                className="object-cover"
                                            />
                                        )}
                                        <AvatarFallback className="bg-slate-200 text-slate-600 font-semibold text-sm">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col text-left md:text-center leading-tight">
                                        <span className="font-semibold text-sm truncate max-w-[140px]">
                                            {user?.name ?? "Staff"}
                                        </span>
                                        <span className="hidden md:block text-xs text-gray-500 truncate">
                                            {user?.email ?? ""}
                                        </span>
                                        {/* Role badge — reminds staff of their access level */}
                                        <span className="text-xs text-blue-500 font-medium capitalize">
                                            {user?.role ?? "staff"}
                                        </span>
                                    </div>
                                </CardHeader>
                            </Card>
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent side="top" align="start" className="w-44">
                        <DropdownMenuItem
                            onClick={() => navigate("/admin")}
                            className="cursor-pointer"
                        >
                            My Profile
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