import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlusIcon, CarIcon } from "lucide-react";
export default function Revenue() {
  return (
    <>
      <div>
        <div>
          <p className="text-2xl font-bold">Revenue Streams</p>
          <p className="text-gray-500 text-sm">
            Manage extra income sources beyond rents
          </p>
        </div>
        <Tabs className="mt-4 bg-white rounded-lg">
          <TabsList className="bg-white rounded-lg hover:bg-gray-100">
            <TabsTrigger value="allstreams">All Streams</TabsTrigger>

            <TabsTrigger value="parking">Parking</TabsTrigger>
            <TabsTrigger value="brand-deals">Brand Deals </TabsTrigger>
          </TabsList>
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
                <Card className="mt-4 w-75 ml-4">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <CarIcon className="w-8 h-8 bg-blue-100 rounded-md text-blue-500 p-2" />
                    <div className="flex items-start gap-3">
                      <div>
                        <CardTitle className="text-xl font-bold text-gray-800">
                          Parking Spot #22
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          Parking Revenue
                        </p>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm w-15 border border-green-400">
                      Active
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
                            $150
                          </p>
                        </div>
                        <button className="text-gray-500 hover:text-gray-700 text-sm">
                          Edit
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="parking">
            <Card>
              <CardHeader>
                <CardTitle>Parking</CardTitle>
              </CardHeader>
              <Card className="mt-4 w-75 ml-4">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <CarIcon className="w-8 h-8 bg-blue-100 rounded-md text-blue-500 p-2" />
                    <div className="flex items-start gap-3">
                      <div>
                        <CardTitle className="text-xl font-bold text-gray-800">
                          Parking Spot #22
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          Parking Revenue
                        </p>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm w-15 border border-green-400">
                      Active
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
                            $150
                          </p>
                        </div>
                        <button className="text-gray-500 hover:text-gray-700 text-sm">
                          Edit
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            </Card>

          </TabsContent>
          <TabsContent value="brand-deals">
            <Card>
              <CardHeader>
                <CardTitle>Brand Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <Card className="mt-4 w-75 ml-4">
                  <CardHeader>
                    <CardTitle>Brand Deal #1</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Brand Deal #1</p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
