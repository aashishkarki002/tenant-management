import React from "react";
import { useAuth } from "./context/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  DollarSign,
  HouseIcon,
  PlusIcon,
  Users,
  WrenchIcon,
  WalletIcon,
  CalendarDaysIcon,
  AlertCircleIcon,
} from "lucide-react";
import api from "../plugins/axios";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [rents, setRents] = useState([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  useEffect(() => {
    const getTenants = async () => {
      const response = await api.get("/api/tenant/get-tenants");
      setTenants(response.data.tenants);
    };
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
    };
    const getRents = async () => {
      const response = await api.get("/api/rent/get-rents");
      setRents(response.data.rents);
    };
    const getTotalCollected = async () => {
      const response = await api.get("/api/rent/get-total-collected");
      setTotalCollected(response.data.totalCollected);
    };
    const getTotalDue = async () => {
      const response = await api.get("/api/rent/get-total-due");
      setTotalDue(response.data.totalDue);
    };
    getTotalCollected();
    getTotalDue();
    getTenants();
    getUnits();
    getRents();
  }, []);
  console.log(tenants);
  console.log(units);
  console.log(rents);
  return (
    <div>
      <p className="text-3xl font-bold">Dashboard</p>
      <p className="text-gray-500">Welcome {user.name}</p>
      <div className="grid grid-cols-4 gap-6 mt-4">
        <Card className="flex gap-4 w-62">
          <CardHeader>
            <CardTitle className="flex items-center  justify-between">
              <p className="text-gray-500">Total Tenants</p>
              <div className="p-2 bg-blue-50 rounded-md text-accent w-10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">{tenants.length}</p>
            <p className="text-gray-500 text-sm">
              +{tenants.length - tenants.length} this month
            </p>
          </CardContent>
        </Card>
        <Card className="flex gap-2 w-62">
          <CardHeader>
            <CardTitle className="flex items-center  justify-between">
              <p className="text-gray-500">Occupency Rate</p>
              <div className="p-2 bg-blue-50 rounded-md text-accent w-10">
                <HouseIcon className="w-5 h-5 text-green-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              {(units.length / tenants.length) * 100}%
            </p>
            <p className="text-gray-500 text-sm">
              +
              {(units.length / tenants.length) * 100 -
                (units.length / tenants.length) * 100}
              % this month
            </p>
          </CardContent>
        </Card>
        <Card className="flex gap-2 w-62">
          <CardHeader>
            <CardTitle className="flex items-center  justify-between">
              <p className="text-gray-500">Rent Due Today</p>
              <div className="p-2 bg-blue-50 rounded-md text-accent w-10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{rents.reduce((sum, rent) => sum + rent.remainingAmount, 0)}
            </p>
            <p className="text-gray-500 text-sm">
              +₹
              {rents.reduce((sum, rent) => sum + rent.remainingAmount, 0) -
                rents.reduce((sum, rent) => sum + rent.remainingAmount, 0)}{" "}
              this month
            </p>
          </CardContent>
        </Card>
        <Card className="flex gap-2 w-62">
          <CardHeader>
            <CardTitle className="flex items-center  justify-between">
              <p className="text-gray-500">Monthly Revenue</p>
              <div className="p-2 bg-blue-50 rounded-md text-accent w-10">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{rents.reduce((sum, rent) => sum + rent.paidAmount, 0)}
            </p>
            <p className="text-gray-500 text-sm">
              +₹
              {rents.reduce((sum, rent) => sum + rent.paidAmount, 0) -
                rents.reduce((sum, rent) => sum + rent.remainingAmount, 0)}
              this month
            </p>
          </CardContent>
        </Card>
      </div>
      <div className=" mt-6">
        <Card className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 items-center">
            <Card
              className="flex gap-2 w-85 bg-blue-50 ml-4 p-4 cursor-pointer"
              onClick={() => navigate("/tenant/addTenants")}
            >
              <CardHeader>
                <CardTitle className="flex items-center  gap-4">
                  <PlusIcon className="w-10 h-10 text-white bg-blue-500 rounded-md p-2" />
                  <div>
                    {" "}
                    <p className="text-black">Total Tenants </p>
                    <p className="text-blue-500 text-sm mt-2">
                      Register a new lease
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent></CardContent>
            </Card>

            <Card
              className="flex gap-2 w-85 bg-green-50 p-4 cursor-pointer"
              onClick={() => navigate("/rent-payment")}
            >
              <CardHeader>
                <CardTitle className="flex items-center  gap-4">
                  <WalletIcon className="w-10 h-10 text-white bg-green-800 rounded-md p-2" />
                  <div>
                    {" "}
                    <p className="text-black">Record Rent </p>
                    <p className="text-green-800 text-sm mt-2">
                      Mark rent as paid
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent></CardContent>
            </Card>
            <Card
              className="flex gap-2 w-85 bg-yellow-50 p-4 cursor-pointer"
              onClick={() => navigate("/maintenance")}
            >
              <CardHeader>
                <CardTitle className="flex items-center  gap-4">
                  <WrenchIcon className="w-10 h-10 text-white bg-yellow-700 rounded-md p-2" />
                  <div>
                    {" "}
                    <p className="text-black">Maintenance </p>
                    <p className="text-yellow-700 text-sm mt-2">
                      Schedule a repair
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent></CardContent>
            </Card>
          </CardContent>
        </Card>
        <div className="flex ">
          <div className=" flex-2 ">
            <Card className="mt-6 w-full">
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 bg-blue-50 p-4 rounded-md  ">
                  <AlertCircleIcon className="w-10 h-10 text-red-500 rounded-md p-2 bg-blue-50" />
                  <div className="flex flex-col gap-2">
                    <p className="text-black text-sm">
                      Rent OverDue: {units[0]?.name}
                    </p>
                    <p className="text-gray-500 text-sm">
                      Due date was yesterday
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Button className="bg-gray-50 text-black hover:bg-black hover:text-white ">
                      Remind
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 bg-blue-50 p-4 rounded-md mt-4">
                  <CalendarDaysIcon className="w-10 h-10 text-blue-500 rounded-md p-2 bg-blue-50" />
                  <div className="flex flex-col gap-2">
                    <p className="text-black text-sm">
                      Contract Ending {units[0]?.name}
                    </p>
                    <p className="text-gray-500 text-sm">
                      Contract ending in 10 days
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Button className="bg-gray-50 text-black hover:bg-black hover:text-white ">
                      Remind
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 bg-blue-50 p-4 rounded-md mt-4">
                  <WrenchIcon className="w-10 h-10 text-yellow-500 rounded-md p-2 bg-blue-50" />
                  <div className="flex flex-col gap-2">
                    <p className="text-black text-sm">
                      Repair Scheduled : {units[0]?.name}
                    </p>
                    <p className="text-gray-500 text-sm">
                      Repair scheduled for {units[0]?.name}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Button className="bg-gray-50 text-black hover:bg-black hover:text-white ">
                      Remind
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex-1">
            <Card className="mt-6 w-100">
              <CardHeader>
                <CardTitle>Building Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 mb-2 flex justify-between">
                  Occupency{" "}
                  <span className="text-black font-bold">
                    {(units.length / tenants.length) * 100}%
                  </span>{" "}
                </p>
                <Progress
                  value={(units.length / tenants.length) * 100}
                  className="w-full bg-blue-200"
                />
                <p className="text-gray-500 mb-2 flex justify-between mt-4">
                  Rent Collected{" "}
                  <span className="text-black font-bold">
                    {totalCollected} / {totalDue}
                  </span>{" "}
                </p>
                <Progress
                  value={(totalCollected / totalDue) * 100}
                  className="w-full bg-green-600"
                />
                <p className="text-gray-500 mb-2 flex justify-between mt-4">
                  Maintenance <span className="text-black font-bold">20%</span>{" "}
                </p>
                <Progress value={20} className="w-full bg-yellow-600 mt-2" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
