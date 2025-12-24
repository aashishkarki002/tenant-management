import React from "react";
import { Input } from "@/components/ui/input";
import { House, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { Phone } from "lucide-react";
import { Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown } from "lucide-react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Tenants() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
      </div>
      <p className="text-gray-500">Manage your residents and their details</p>
      <div className="flex flex-wrap justify-between items-center my-4 gap-2 sm:gap-4 w-full">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            type="text"
            placeholder="Search by name, unit, block"
            className="pl-10 h-10 w-full text-sm border-gray-300 rounded-md"
          />
        </div>

        {/* Dropdown */}
        <div className="w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 h-10 w-full sm:w-auto justify-center"
              >
                Select Block
                <ArrowDown className="w-5 h-5 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-full sm:w-56" align="start">
              <DropdownMenuLabel>Select Block</DropdownMenuLabel>

              <DropdownMenuGroup className="flex flex-col gap-1">
                {/* Birendra Block Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="w-full text-left">
                    Birendra Block
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-full sm:w-56">
                    <DropdownMenuItem>Sagar Block</DropdownMenuItem>
                    <DropdownMenuItem>Jyoti Block</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Narendra Block Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="w-full text-left">
                    Narendra Block
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-full sm:w-56">
                    <DropdownMenuItem>Saurya Block</DropdownMenuItem>
                    <DropdownMenuItem>Block</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Add Tenant Button */}
        <div className="w-full sm:w-auto">
          <Button
            className="bg-blue-600 text-blue-50 h-10 px-4 rounded-md hover:bg-blue-800 flex 
           items-center gap-2 w-full sm:w-auto justify-center
           cursor-pointer
           "
            onClick={() => {
              navigate("/tenant/addTenants");
            }}
          >
            <Plus className="w-5 h-5" />
            Add new Tenant
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ">
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate("/tenant/editTenant")}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate("/tenant/editTenant")}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
          <CardContent>
            <div className="text-center">
              <div className="flex justify-between">
                <h2 className="text-black text-lg font-semibold">
                  Utshaha shrestha
                </h2>
                <p>
                  <DropdownMenu>
                    <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </p>
              </div>

              <p className="text-gray-500 text-sm text-left flex items-center gap-2">
                <House className="w-4 h-4 text-gray-500" />
                Unit 101
              </p>
            </div>
            <div className="text-gray-500 text-sm mt-3">
              <div className="flex flex-col gap-2 w-full ">
                <div className="flex mb-2 justify-between items-center w-full">
                  <p className="text-black text-sm">Status</p>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 w-20 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-black text-sm">Rent</p>
                  <p className="text-black text-sm ml-3">₹80000</p>
                </div>
              </div>
              <div className="flex justify-between items-center w-full">
                <Badge className="bg-blue-50 text-blue-600 mr-2 w-full p-4 mt-2 rounded-md ">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                      Lease End
                    </div>
                    <div>
                      <p className="text-black text-sm ml-3">2025-12-18</p>
                    </div>
                  </div>
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center w-full ">
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-green-100 hover:text-green-600">
                  <Phone className="w-5 h-5 mr-2 stroke-black transition-colors duration-200 hover:stroke-green-600" />
                  Call
                </Button>
                <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200 hover:bg-blue-100 hover:text-blue-600">
                  <Mail className="w-5 h-5 text-black mr-2  " />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
