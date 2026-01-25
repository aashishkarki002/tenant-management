import React, { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlusIcon, CarIcon, TagIcon, Bike, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "../plugins/axios";
import {
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DualCalendarTailwind from "@/components/dualDate";
import { useFormik } from "formik";

// Sample data - in a real app, this would come from an API
const initialParkingSpots = [
  {
    id: 1,
    name: "Parking Spot #22",
    monthlyIncome: 150,
    status: "Active",
  },
];

const initialBrandDeals = [
  {
    id: 1,
    name: "Brand Deal #1",
    monthlyIncome: 500,
    status: "Active",
  },
];

export default function Revenue() {
  const [parkingSpots, setParkingSpots] = useState(initialParkingSpots);
  const [brandDeals, setBrandDeals] = useState(initialBrandDeals);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [revenueType, setRevenueType] = useState("parking");
  const [revenueSource, setRevenueSource] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [referenceId, setReferenceId] = useState("");
  const [tenants, setTenants] = useState([]);
useEffect(() => { 
  const getRevenueSource = async () => {
    try {
      const response = await api.get("/api/revenue/get-revenue-source");
      if (response.data && Array.isArray(response.data.revenueSource)) {
        setRevenueSource(response.data.revenueSource);
      } else {
        setRevenueSource([]);
      }
    } catch (error) {
      console.error("Error fetching revenue source:", error);
      setRevenueSource([]);
    }
  };
  getRevenueSource();
  const getBankAccounts = async () => {
    const response = await api.get("/api/bank/get-bank-accounts");
    const data = await response.data;
    setBankAccounts(data.bankAccounts);
  };
  getBankAccounts();
}, []);

  const getTenants = async () => {
    const response = await api.get("/api/tenant/get-tenants");
    const data = await response.data;
    setTenants(data.tenants);
  };
  getTenants();

  const formik = useFormik({
    initialValues: {
      referenceType: "",
      referenceId: "",
      amount: "",
      date: "",
      notes: "",
      bankAccount: "",
      paymentSchedule: "",
      notes: "",
      notes: "",
    },
  });

  // Render parking spot card
  const renderParkingSpot = (spot) => (
   
    <Card key={spot.id} className="mt-4 w-75 ml-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <CarIcon className="w-8 h-8 bg-blue-100 rounded-md text-blue-500 p-2" />
        <div className="flex items-start gap-3 ">
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">
              {spot.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Parking Revenue
            </p>
          </div>
        </div>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm w-15 border border-green-400">
          {spot.status}
        </span>
      </CardHeader>
      <CardContent>
        <div className="border-t border-gray-200 pt-4 mt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Monthly Income
              </p>
              <p className="text-2xl font-bold text-gray-800">
                ${spot.monthlyIncome}
              </p>
            </div>
            <button className="text-gray-500 hover:text-gray-700 text-sm">
              Edit
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render brand deal card
  const renderBrandDeal = (deal) => (
    <Card key={deal.id} className="mt-4 w-75 ml-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <TagIcon className="w-8 h-8 bg-purple-100 rounded-md text-purple-500 p-2" />
        <div className="flex items-start gap-3">
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">
              {deal.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Brand Deal Revenue
            </p>
          </div>
        </div>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm w-15 border border-green-400">
          {deal.status}
        </span>
      </CardHeader>
      <CardContent>
        <div className="border-t border-gray-200 pt-4 mt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Monthly Income
              </p>
              <p className="text-2xl font-bold text-gray-800">
                ${deal.monthlyIncome}
              </p>
            </div>
            <button className="text-gray-500 hover:text-gray-700 text-sm">
              Edit
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div>
        <div>
          <p className="text-2xl font-bold">Revenue Streams</p>
          <p className="text-gray-500 text-sm">
            Manage extra income sources beyond rents
          </p>
        </div>
        <Tabs className="mt-4 bg-white rounded-lg" defaultValue="allstreams">
          <TabsList className="bg-white rounded-lg hover:bg-gray-100">
            <TabsTrigger value="allstreams">All Streams</TabsTrigger>
            <TabsTrigger value="parking">Parking</TabsTrigger>
            <TabsTrigger value="brand-deals">Brand Deals</TabsTrigger>
          </TabsList>
          
          {/* All Streams Tab - Shows both parking and brand deals */}
          <TabsContent value="allstreams">
            <Card>
              <div>
                <CardContent className="flex gap-2">
                  <Button className="bg-gray-100 text-black hover:bg-gray-200">
                    <PlusIcon className="w-5 h-5" />
                    Add Parking Slot
                  </Button>
                  <Button className="bg-gray-100 text-black hover:bg-gray-200">
                    <PlusIcon className="w-5 h-5" />
                    Add Brand Deal
                  </Button>
                </CardContent>
              </div>
              <div>
                {parkingSpots.length > 0 && parkingSpots.map(renderParkingSpot)}
                {brandDeals.length > 0 && brandDeals.map(renderBrandDeal)}
                {parkingSpots.length === 0 && brandDeals.length === 0 && (
                  <Card className="mt-4 w-75 ml-4">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <EmptyTitle>No Revenue Streams</EmptyTitle>
                      <EmptyDescription>Add parking slots or brand deals to get started</EmptyDescription>
                    </CardContent>
                  </Card>
                )}
                <div 
                  onClick={() => setIsDialogOpen(true)}
                  className="mt-4 w-75 ml-4 border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors bg-white"
                >
                  <button className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <PlusIcon className="w-6 h-6 text-gray-600" />
                  </button>
                  <p className="mt-4 text-gray-700 font-medium">Add New Stream</p>
                </div>
              </div>
            </Card>
          </TabsContent>
          {/* Parking Tab - Shows only parking spots */}
          <TabsContent value="parking">
            <Card>
              <CardHeader>
                <CardTitle>Parking</CardTitle>
              </CardHeader>
              <CardContent>
                {parkingSpots.length > 0 ? (
                  parkingSpots.map(renderParkingSpot)
                ) : (
                  <Card className="mt-4 w-75 ml-4">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <EmptyTitle>No Parking Spots</EmptyTitle>
                      <EmptyDescription>Add a parking slot to get started</EmptyDescription>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Deals Tab - Shows only brand deals */}
          <TabsContent value="brand-deals">
            <Card>
              <CardHeader>
                <CardTitle>Brand Deals</CardTitle>
              </CardHeader>
              <CardContent>
                {brandDeals.length > 0 ? (
                  brandDeals.map(renderBrandDeal)
                ) : (
                  <Card className="mt-4 w-75 ml-4">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <EmptyTitle>No Brand Deals</EmptyTitle>
                      <EmptyDescription>Add a brand deal to get started</EmptyDescription>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
           
          </TabsContent>
        </Tabs>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Revenue Stream</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Revenue Type Tabs */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">REVENUE TYPE:</Label>
              <Tabs value={revenueType} onValueChange={setRevenueType} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="parking">Parking Slot</TabsTrigger>
                  <TabsTrigger value="brand">Brand Deal</TabsTrigger>
                  <TabsTrigger value="other">Other Services</TabsTrigger>
                </TabsList>
             
         <TabsContent value="parking">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">General Details:</h3>
              
              <div className="space-y-2">
                <Label htmlFor="title">Tenant ID</Label>
                <Select
                  id="title"
                  placeholder="Enter Tenant ID"
                  value={formik.values.tenantId}
                  onValueChange={(value) => formik.setFieldValue("tenantId", value)}
                >
                  <SelectTrigger id="tenantId" className="w-full">
                    <SelectValue placeholder="Select Tenant ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>{tenant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
<div className="flex gap-2">
              <div className="space-y-2 w-1/2">
                <Label htmlFor="category">Reference Type</Label>
                <Select
                  value={formik.values.referenceType}
                  onValueChange={(value) => formik.setFieldValue("referenceType", value)}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="Select Reference Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(revenueSource) && revenueSource.map((source) => (
                      <SelectItem key={source._id} value={source.name}>{source.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-1/2">
                <Label htmlFor="notes">Reference ID</Label>
                <Input
                  id="referenceId"
                  placeholder="Enter Reference ID"
                  value={formik.values.referenceId}
                  onChange={(e) => formik.setFieldValue("referenceId", e.target.value)}
                />
              </div>
              </div>
              <div className="flex gap-2">
              <div className="space-y-2 w-1/2">
                <Label htmlFor="incomeAmount">Income Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <Input
                    id="incomeAmount"
                    type="number"
                    placeholder="0.00"
                    value={formik.values.amount}
                    onChange={(e) => formik.setFieldValue("amount", e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
<div className="space-y-2 w-1/2"><Label>Bank Account</Label>
<Select
  value={formik.values.bankAccount}
  onValueChange={(value) => formik.setFieldValue("bankAccount", value)}
>
  <SelectTrigger id="bankAccount" className="w-full">
    <SelectValue placeholder="Select Bank Account" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="bank_transfer">{bankAccounts.map((bank) => (
      <SelectItem key={bank._id} value={bank._id}>{bank.bankName}</SelectItem>
    ))}</SelectItem>
 
  </SelectContent>
</Select>
</div></div>
              <div className="space-y-2">
                <Label htmlFor="agreementDuration">Payment Schedule</Label>
                <DualCalendarTailwind
                  value={formik.values.date}
                  onChange={(englishDate) => {
                    formik.setFieldValue("date", englishDate);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Enter Notes"
                  value={formik.values.notes}
                  onChange={(e) => formik.setFieldValue("notes", e.target.value)}
                />
              </div>
            </div>
 </TabsContent> 
 <TabsContent value="brand">
  <div>
    <h3>Brand Deal Details</h3>
  </div>
 </TabsContent>
 </Tabs>
            </div>
            {/* Specific Details: Parking Slot */}
          
            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  // Handle save logic here
                  console.log("Form Data:", formData);
                  setIsDialogOpen(false);
                  // Reset form
                  setFormData({
                    title: "",
                    category: "monthly",
                    incomeAmount: "",
                    agreementDuration: "",
                    vehicleType: "car",
                    slotFloor: "",
                  });
                }}
              >
                <Check className="w-4 h-4 mr-2" />
                Save Revenue Stream
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
