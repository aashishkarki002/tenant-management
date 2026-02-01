import React, { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlusIcon, CarIcon, TagIcon } from "lucide-react";
import {
  Empty,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import api from "../plugins/axios";
import { AddRevenueDialog } from "./Revenue/components/AddRevenueDialog";

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
  const [revenueSource, setRevenueSource] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
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
  }, []);

  useEffect(() => {
    const getBankAccounts = async () => {
      try {
        const response = await api.get("/api/bank/get-bank-accounts");
        const data = await response.data;
        setBankAccounts(data.bankAccounts ?? []);
      } catch (error) {
        console.error("Error fetching bank accounts:", error);
        setBankAccounts([]);
      }
    };
    getBankAccounts();
  }, []);

  useEffect(() => {
    const getTenants = async () => {
      try {
        const response = await api.get("/api/tenant/get-tenants");
        const data = await response.data;
        setTenants(data.tenants ?? []);
      } catch (error) {
        console.error("Error fetching tenants:", error);
        setTenants([]);
      }
    };
    getTenants();
  }, []);

  const renderParkingSpot = (spot) => (
    <Card key={spot.id} className="mt-4 w-75 ml-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <CarIcon className="w-8 h-8 bg-blue-100 rounded-md text-blue-500 p-2" />
        <div className="flex items-start gap-3 ">
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">
              {spot.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">Parking Revenue</p>
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

  const renderBrandDeal = (deal) => (
    <Card key={deal.id} className="mt-4 w-75 ml-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <TagIcon className="w-8 h-8 bg-purple-100 rounded-md text-purple-500 p-2" />
        <div className="flex items-start gap-3">
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">
              {deal.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">Brand Deal Revenue</p>
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

          <TabsContent value="allstreams">
            <Card>


              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch">
                {parkingSpots.length > 0 && parkingSpots.map(renderParkingSpot)}
                {brandDeals.length > 0 && brandDeals.map(renderBrandDeal)}

                {parkingSpots.length === 0 && brandDeals.length === 0 && (
                  <Card className="w-full h-full">
                    <CardContent className="flex flex-col items-center justify-center h-full py-8">
                      <EmptyTitle>No Revenue Streams</EmptyTitle>
                      <EmptyDescription>
                        Add parking slots or brand deals to get started
                      </EmptyDescription>
                    </CardContent>
                  </Card>
                )}

                <Empty
                  className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg p-8
               flex flex-col items-center justify-center cursor-pointer
               hover:border-gray-400 transition-colors bg-white"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Button
                    variant="outline"
                    className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200"
                  >
                    <PlusIcon className="w-6 h-6 text-gray-600" />
                  </Button>
                  <p className="mt-4 text-gray-700 font-medium text-sm">
                    Add New Stream
                  </p>
                </Empty>
              </div>

            </Card>
          </TabsContent>

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
                      <EmptyDescription>
                        Add a parking slot to get started
                      </EmptyDescription>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                      <EmptyDescription>
                        Add a brand deal to get started
                      </EmptyDescription>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddRevenueDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        tenants={tenants}
        revenueSource={revenueSource}
        bankAccounts={bankAccounts}
        onSuccess={() => {
          // Optionally refresh lists or show toast
        }}
      />
    </>
  );
}