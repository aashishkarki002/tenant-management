import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import { Phone } from 'lucide-react';
import { Calendar } from 'lucide-react';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {DropdownMenuLabel, DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
  } from "@/components/ui/drawer"
export default function Tenants() {
  
  const getData=async() => {
    try {
    const data = await axios.get('https://fakestoreapi.com/products');
    
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getData();
  }, []);
    return (
        <div>
            <div className='flex justify-between'>
            <h1 className="text-2xl font-bold">Tenants</h1>
            <Drawer>
            <DrawerTrigger asChild>
            <Button className="bg-blue-600 text-blue-50 mr-2 w-45 mt-2 p-3 rounded-md hover:bg-blue-800 "><Plus className="w-5 h-5 text-blue-50 " />Add new Tenant</Button></DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Add new Tenant</DrawerTitle>
      <DrawerDescription>
       Add new tenant to the system
      </DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="outline">Cancel</Button>
      </DrawerClose>
      <Button ><Link to="/addTenants">Continue</Link></Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
           
   
  
</div>
            <p className="text-gray-500">Manage your residents and their details</p>
            <Input
              icon={<Search className="w-5 h-5 text-gray-500" />}
              type="text"
              placeholder="Search name, unit, lease end (YYYY-MM-DD)"
              className="border-gray-300 rounded-md mt-6 p-1 w-100 text-sm h-10"
            />
            <div className="flex flex-row grid grid-cols-3 gap-4 mt-6">
            <Card className="w-77 h-70">
                <CardContent>
                    <div className='text-center'>
                        <div className='flex justify-between'> <h2 >Utshaha shrestha</h2>
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
</p></div>
                   
                    <p className="text-gray-500 text-sm text-left">@ Unit 101</p></div>
                    <div className="text-gray-500 text-sm mt-3">
                        <div className='flex mb-2 justify-between'>
                        <p>Status</p>
                    <Badge className='ml-20 bg-green-50 text-green-600 w-20 border-green-600'>Active</Badge></div>
<div className='flex justify-between'> <p>Rent</p>
<p className='text-black text-sm ml-3'>₹80000</p></div>
                   
                   <Badge className="bg-blue-50 text-blue-600 mr-2 w-66 mt-2 p-3 rounded-md "><Calendar className="w-5 h-5 text-gray-500 mr-2" />Lease End <p className='text-black text-sm ml-3'>2025-12-18</p></Badge>
                    <div className='mt-10 '><Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200" ><Phone className="w-5 h-5 text-black mr-2" />Call</Button>
                    <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200">
                      <Mail className="w-5 h-5 text-black mr-2" />
                      Email
                    </Button>
                    </div>
                    </div>

                </CardContent>
            </Card>
            <Card className="w-77 h-70">
                <CardContent>
                    <div className='text-center'>
                        <div className='flex justify-between'> <h2 >Utshaha shrestha</h2>
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
</p></div>
                   
                    <p className="text-gray-500 text-sm text-left">@ Unit 101</p></div>
                    <div className="text-gray-500 text-sm mt-3">
                        <div className='flex mb-2 justify-between'>
                        <p>Status</p>
                    <Badge className='ml-20 bg-green-50 text-green-600 w-20 border-green-600'>Active</Badge></div>
<div className='flex justify-between'> <p>Rent</p>
<p className='text-black text-sm ml-3'>₹80000</p></div>
                   
                   <Badge className="bg-blue-50 text-blue-600 mr-2 w-66 mt-2 p-3 rounded-md "><Calendar className="w-5 h-5 text-gray-500 mr-2" />Lease End <p className='text-black text-sm ml-3'>2025-12-18</p></Badge>
                    <div className='mt-10 '><Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200" ><Phone className="w-5 h-5 text-black mr-2" />Call</Button>
                    <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200">
                      <Mail className="w-5 h-5 text-black mr-2" />
                      Email
                    </Button>
                    </div>
                    </div>

                </CardContent>
            </Card>
            <Card className="w-77 h-70">
                <CardContent>
                    <div className='text-center'>
                        <div className='flex justify-between'> <h2 >Utshaha shrestha</h2>
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
</p></div>
                   
                    <p className="text-gray-500 text-sm text-left">@ Unit 101</p></div>
                    <div className="text-gray-500 text-sm mt-3">
                        <div className='flex mb-2 justify-between'>
                        <p>Status</p>
                    <Badge className='ml-20 bg-green-50 text-green-600 w-20 border-green-600'>Active</Badge></div>
<div className='flex justify-between'> <p>Rent</p>
<p className='text-black text-sm ml-3'>₹80000</p></div>
                   
                   <Badge className="bg-blue-50 text-blue-600 mr-2 w-66 mt-2 p-3 rounded-md "><Calendar className="w-5 h-5 text-gray-500 mr-2" />Lease End <p className='text-black text-sm ml-3'>2025-12-18</p></Badge>
                    <div className='mt-10 '><Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200" ><Phone className="w-5 h-5 text-black mr-2" />Call</Button>
                    <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200">
                      <Mail className="w-5 h-5 text-black mr-2" />
                      Email
                    </Button>
                    </div>
                    </div>

                </CardContent>
            </Card>
            <Card className="w-77 h-70">
                <CardContent>
                    <div className='text-center'>
                        <div className='flex justify-between'> <h2 >Utshaha shrestha</h2>
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
</p></div>
                   
                    <p className="text-gray-500 text-sm text-left">@ Unit 101</p></div>
                    <div className="text-gray-500 text-sm mt-3">
                        <div className='flex mb-2 justify-between'>
                        <p>Status</p>
                    <Badge className='ml-20 bg-green-50 text-green-600 w-20 border-green-600'>Active</Badge></div>
<div className='flex justify-between'> <p>Rent</p>
<p className='text-black text-sm ml-3'>₹80000</p></div>
                   
                   <Badge className="bg-blue-50 text-blue-600 mr-2 w-66 mt-2 p-3 rounded-md "><Calendar className="w-5 h-5 text-gray-500 mr-2" />Lease End <p className='text-black text-sm ml-3'>2025-12-18</p></Badge>
                    <div className='mt-10 '><Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200" ><Phone className="w-5 h-5 text-black mr-2" />Call</Button>
                    <Button className="bg-gray-50 text-black mr-2 w-30 hover:bg-gray-200">
                      <Mail className="w-5 h-5 text-black mr-2" />
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