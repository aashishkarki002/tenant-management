import React from "react";
import { Input } from "@/components/ui/input";
import { House, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
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
import TenantCard from "./components/TenantCard";
import api from "../plugins/axios";

export default function Tenants() {
const [tenants, setTenants] = useState([]);
const [properties, setProperties] = useState([]);
const [loading, setLoading] = useState(true);

const fetchData = async () => {
  setLoading(true);
  try {
    const fetchtenants = async () => {
      const response = await api.get("/api/tenant/get-tenants");
      const data = await response.data;
      setTenants(data.tenants);
    };
    
    const fetchblocks = async () => {
      const response = await api.get("/api/property/get-property");
      const data = await response.data;
      setProperties(data.property || []);
      console.log(data.property);
    };

    // Fetch both in parallel
    await Promise.all([fetchtenants(), fetchblocks()]);
  } catch (error) {
    console.error("Error fetching data:", error);
    // If it's a 401, the axios interceptor will handle redirecting to login
    if (error.response?.status === 401) {
      console.error("Unauthorized - token may be missing or invalid");
    }
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchData();
}, []);

const HandleDeleteTenant =  () => {
  fetchData();
}


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
                {properties && properties.length > 0 ? (
                  properties.flatMap((property) => 
                    property.blocks && property.blocks.length > 0 
                      ? property.blocks.map((block) => (
                          <DropdownMenuSub key={block._id}>
                            <DropdownMenuSubTrigger className="w-full text-left">
                              {block.name || `Block ${block._id}`}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-full sm:w-56">
                              {block.innerBlocks && block.innerBlocks.length > 0 ? (
                                block.innerBlocks.map((innerBlock) => (
                                  <DropdownMenuItem key={innerBlock._id}>
                                    {innerBlock.name || `Inner Block ${innerBlock._id}`}
                                  </DropdownMenuItem>
                                ))
                              ) : (
                                <DropdownMenuItem disabled>No inner blocks</DropdownMenuItem>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ))
                      : []
                  )
                ) : (
                  <DropdownMenuItem disabled>No blocks available</DropdownMenuItem>
                )}
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
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <Spinner className="size-10" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full">
            <p className="text-center text-gray-500 py-12">No tenants found</p>
          </div>
        ) : (
          tenants.map((tenant) => (
            <TenantCard key={tenant._id} tenant={tenant} HandleDeleteTenant={HandleDeleteTenant} />
          ))
        )}
      </div>
    </div>
  );
}
