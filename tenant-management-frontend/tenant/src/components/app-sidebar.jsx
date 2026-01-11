import {
  LayoutDashboard,
  Users,
  DollarSign,
  FileText,
  BarChart,
  Wrench,
  Banknote,
  Zap,
} from "lucide-react";

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
import api from "../../plugins/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
// Menu items
const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tenants", url: "/tenants", icon: Users },
  { title: "Rent & Payments", url: "/rent-payment", icon: DollarSign },
  { title: "Accounting", url: "/accounting", icon: FileText },
  { title: "Revenue Streams", url: "/revenue", icon: BarChart },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Cheque Drafts", url: "/cheque-drafts", icon: Banknote },
  { title: "Electricity", url: "/electricity", icon: Zap },
];

export default function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();

  const navigate = useNavigate();

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };
  const { user, logout } = useAuth();
  const SignOut = async () => {
    try {
      // Try to call the logout endpoint, but don't fail if it errors
      try {
        await api.post("/api/auth/logout");
      } catch (apiError) {
        // Log but don't show error - we'll still clear local state
      }

      // Always clear local state and redirect, regardless of API call result
      logout();
      navigate("/login");
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if there's an error, clear local state and redirect
      logout();
      navigate("/login");
      toast.success("Signed out successfully");
    }
  };
  return (
    <Sidebar variant="sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xl font-bold ml-4 md:ml-10 mt-6 text-black">
            EasyManage
          </SidebarGroupLabel>
          <Separator className="w-full h-px md:h-1 bg-gray-200 my-2" />
          <SidebarGroupLabel className="">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent className="p-3">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  className="mb-2 text-gray-500"
                >
                  <SidebarMenuButton
                    asChild
                    className="hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center gap-2"
                    onClick={handleNav}
                  >
                    <Link to={item.url}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full  cursor-pointer outline-none border-none bg-transparent text-left">
              <Card className="w-full cursor-pointer hover:bg-gray-200 bg-gray-50 transition-colors">
                <CardHeader className="flex flex-row md:flex-col items-center gap-2 p-3">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="text-center font-semibold">
                    {user?.name ?? "Admin"}
                  </div>
                  <div className="text-center text-gray-500 text-sm">
                    {user?.email ?? "admin@gmail.com"}
                  </div>
                </CardHeader>
              </Card>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="center"
            className="min-w-[10rem] w-auto"
          >
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={SignOut}>
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
