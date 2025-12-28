import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone } from 'lucide-react';
import { Mail } from 'lucide-react';
import { House } from 'lucide-react';
import { Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ViewDetail from './ViewDetail';

export default function TenantCard({tenant}) {
  
    const navigate = useNavigate();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    return (
        <Card className="w-full h-70 hover:shadow-lg transition-shadow duration-300">
        <CardContent>
          <div className="text-center">
            <div className="flex justify-between">
              <h2 className="text-black text-lg font-semibold">
                {tenant?.name}
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
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setIsDialogOpen(true);
                      }}
                    >
                      View Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </p>
            </div>
<ViewDetail open={isDialogOpen} onOpenChange={setIsDialogOpen} tenant={tenant} />

            <p className="text-gray-500 text-sm text-left flex items-center gap-2">
              <House className="w-4 h-4 text-gray-500" />
              {tenant?.unitNumber}
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
                <p className="text-black text-sm ml-3">₹{tenant?.totalRent}</p>
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
                    <p className="text-black text-sm ml-3">{new Date(tenant?.leaseEndDate).toLocaleDateString()}</p>
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
    )
}