import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap } from "lucide-react";

export default function Electricity() {
  const [building, setBuilding] = useState("Building A");
  const [block, setBlock] = useState("Block 1");
  const [nepaliMonth, setNepaliMonth] = useState("Ashwin 2081");
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [tenant, setTenant] = useState(
    
  );

  return (
    <>
      <div>
        <div className="flex justify-between">
          <div>
            <p className="text-2xl font-bold">Utility Monitoring</p>
            <p className="text-gray-500 text-sm">
              Detailed electricity consumption tracking for buildings
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-gray-100 text-black hover:bg-gray-200">
              <PlusIcon className="w-5 h-5" />
              Export Report
            </Button>
            <Button className="bg-blue-500 text-white hover:bg-blue-600">
              <PlusIcon className="w-5 h-5" />
              Add Reading
            </Button>
          </div>
        </div>
        <div className="mt-4  ">
          
          <Card className="  rounded-lg shadow-lg">
            <CardContent className="p-5 ">
              <div className="flex items-center gap-6 flex-wrap">
                {/* BUILDING Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className=" text-xs font-semibold uppercase tracking-wide">
                    BUILDING:
                  </label>
                  <Select value={building} onValueChange={setBuilding}>
                    <SelectTrigger className="w-[150px] h-9 bg-gray-100 text-black hover:bg-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-500">
                      <SelectItem value="Building A" className=" ">
                        Building A
                      </SelectItem>
                      <SelectItem value="Building B" className="">
                        Building B
                      </SelectItem>
                      <SelectItem value="Building C" className=" ">
                        Building C
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* BLOCK Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className=" text-xs font-semibold uppercase tracking-wide">
                    BLOCK:
                  </label>
                  <Select value={block} onValueChange={setBlock}>
                    <SelectTrigger className="w-[130px] h-9 bg-gray-100 text-black hover:bg-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-100 text-black hover:bg-gray-200">
                      <SelectItem value="Block 1" className="text-gray-100 hover:bg-slate-600">
                      {tenant?.block?.name}
                      </SelectItem>
                      <SelectItem value="Block 2" className="text-gray-100 hover:bg-slate-600">
                        {tenant?.block?.name}
                      </SelectItem>
                      <SelectItem value="Block 3" className="text-gray-100 hover:bg-slate-600">
                        {tenant?.block?.name}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* NEPALI MONTH Input */}
                <div className="flex flex-col gap-1.5">
                  <label className=" text-xs font-semibold uppercase tracking-wide">
                    NEPALI MONTH:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={nepaliMonth}
                      onChange={(e) => setNepaliMonth(e.target.value)}
                      className="w-[170px] h-9 bg-gray-100 text-black hover:bg-gray-200 rounded-md px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/50"
                      placeholder="Ashwin 2081"
                    />
                    <Calendar className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                  </div>
                </div>

                {/* Compare with Previous Toggle */}
                <div className="flex flex-col gap-4">
                  <label className=" text-xs font-semibold uppercase tracking-wide">
                    Compare with Previous
                  </label>
                  <button
                    type="button"
                    onClick={() => setCompareWithPrevious(!compareWithPrevious)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                      compareWithPrevious ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                        compareWithPrevious ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between gap-4 mt-4">
            {/* TOTAL CONSUMPTION CARD */}
            <Card className="rounded-lg shadow-lg w-full bg-white text-black">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold tracking-wide text-gray-500">
                  TOTAL CONSUMPTION
                </CardTitle>
                <Zap className="w-5 h-5 text-black" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold">
                  4,520.4{" "}
                  <span className="text-lg font-medium text-gray-500 align-top">
                    kWh
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  <span className="font-semibold text-black">+5.2%</span>{" "}
                  <span className="text-gray-500">vs last month</span>
                </p>
              </CardContent>
            </Card>

            {/* AVG. PER UNIT CARD */}
            <Card className="rounded-lg shadow-lg w-full bg-white text-black">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wide text-gray-500">
                  AVG. PER UNIT
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold">
                  1.25{" "}
                  <span className="text-lg font-medium text-gray-500 align-top">
                    kWh/unit
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Average consumption per unit
                </p>
              </CardContent>
            </Card>

            {/* TOTAL BILL AMOUNT CARD */}
            <Card className="rounded-lg shadow-lg w-full bg-white text-black">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wide text-gray-500">
                  TOTAL BILL AMOUNT
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold">Rs. 0.00</div>
                <p className="mt-2 text-xs text-gray-500">
                  Total amount for the selected period
                </p>
              </CardContent>
            </Card>
          </div>
            
         
        </div>
      </div>
    </>
  );
}