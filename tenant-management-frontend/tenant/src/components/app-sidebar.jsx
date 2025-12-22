import { LayoutDashboard, Users, DollarSign, FileText, BarChart, Wrench, Banknote } from "lucide-react";

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
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { Link } from "react-router-dom";

// Menu items
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard ,},
  { title: "Tenants", url: "/tenants", icon: Users },
  { title: "Rent & Payments", url: "/rent-payment", icon: DollarSign },
  { title: "Accounting", url: "/accounting", icon: FileText },
  { title: "Revenue Streams", url: "/revenue", icon: BarChart },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Cheque Drafts", url: "/cheque-drafts", icon: Banknote },
];

export default function AppSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xl font-bold ml-10 text-black">EasyManage</SidebarGroupLabel>
          <SidebarGroupLabel className="mt-8 p-3">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent className="p-3">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="mb-2 text-gray-500">
                  <SidebarMenuButton asChild className="hover:bg-blue-100 hover:text-blue-600 rounded-md p-2 flex items-center gap-2">
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
            <button className="w-full p-2 cursor-pointer outline-none border-none bg-transparent text-left">
              <Card className="w-full cursor-pointer hover:bg-gray-200 bg-gray-50 transition-colors">
                <CardHeader className="flex flex-col items-center gap-2 p-4">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="text-center font-semibold">Admin</div>
                  <div className="text-center text-gray-500 text-sm">abs@gmail.com</div>
                </CardHeader>
              </Card>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="center" className="w-44">
            <DropdownMenuItem>
              <span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
