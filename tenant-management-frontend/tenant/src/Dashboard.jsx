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
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalTenants: 0,
    activeTenants: 0,
    tenantsThisMonth: 0,
    occupiedUnits: 0,
    totalUnits: 0,
    occupancyRate: 0,
    rentSummary: {
      totalCollected: 0,
      totalDue: 0,
      totalPending: 0,
    },
    totalRentDue: 0,
    overdueRents: [],
    upcomingRents: [],
    contractsEndingSoon: [],
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/payment/dashboard-stats");
        if (response.data.success && response.data.data) {
          setDashboardData(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Destructure data from backend
  const {
    totalTenants,
    tenantsThisMonth,
    totalUnits,
    occupiedUnits,
    occupancyRate,
    rentSummary,
    totalRentDue,
    overdueRents,
    upcomingRents,
    contractsEndingSoon,
  } = dashboardData;

  const monthlyRevenue = rentSummary.totalCollected || 0;
  const totalDue = rentSummary.totalDue || 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-3xl font-bold">Dashboard</p>
          <p className="text-gray-500 text-xl mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <p className="text-3xl font-bold">Dashboard</p>
        <p className="text-gray-500 text-xl mt-1">
          Welcome {user?.name || "Admin"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <p className="text-gray-500 text-lg">Total Tenants</p>
              <div className="p-2 bg-blue-50 rounded-md">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">{totalTenants}</p>
            <p className="text-gray-500 text-sm mt-1">
              +{tenantsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <p className="text-gray-500 text-lg">Occupancy Rate</p>
              <div className="p-2 bg-green-50 rounded-md">
                <HouseIcon className="w-5 h-5 text-green-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">{occupancyRate}%</p>
            <p className="text-gray-500 text-sm mt-1">
              {occupiedUnits} of {totalUnits} units occupied
            </p>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <p className="text-gray-500 text-lg">Rent Due</p>
              <div className="p-2 bg-orange-50 rounded-md">
                <AlertCircleIcon className="w-5 h-5 text-orange-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{totalRentDue.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {overdueRents.length} overdue payments
            </p>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <p className="text-gray-500 text-lg">Monthly Revenue</p>
              <div className="p-2 bg-purple-50 rounded-md">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{monthlyRevenue.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              of ₹{totalDue.toLocaleString()} total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              className="flex gap-2 w-full bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => navigate("/tenant/addTenants")}
            >
              <CardHeader className="p-0">
                <CardTitle className="flex items-center">
                  <div className="flex items-center gap-3 w-full">
                    <PlusIcon className="w-10 h-10 text-white bg-blue-500 rounded-md p-2" />
                    <div className="flex flex-col">
                      <p className="text-black font-semibold">Add Tenant</p>
                      <p className="text-blue-500 text-sm mt-1">
                        Register a new lease
                      </p>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card
              className="flex gap-2 w-full bg-green-50 p-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => navigate("/rent-payment")}
            >
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-3">
                  <WalletIcon className="w-10 h-10 text-white bg-green-800 rounded-md p-2" />
                  <div>
                    <p className="text-black font-semibold">Record Rent</p>
                    <p className="text-green-800 text-sm mt-1">
                      Mark rent as paid
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card
              className="flex gap-2 w-full bg-yellow-50 p-4 cursor-pointer hover:bg-yellow-100 transition-colors"
              onClick={() => navigate("/maintenance")}
            >
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-3">
                  <WrenchIcon className="w-10 h-10 text-white bg-yellow-700 rounded-md p-2" />
                  <div>
                    <p className="text-black font-semibold">Maintenance</p>
                    <p className="text-yellow-700 text-sm mt-1">
                      Schedule a repair
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>
          </CardContent>
        </Card>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mt-6">
          <div className="flex-1 lg:flex-2">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {overdueRents.length > 0 ? (
                  overdueRents.map((rent, idx) => {
                    const dueDate = new Date(rent.englishDueDate);
                    const daysOverdue = Math.ceil(
                      (new Date() - dueDate) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={rent._id || idx}
                        className="flex gap-3 bg-red-50 p-4 rounded-md border border-red-200"
                      >
                        <AlertCircleIcon className="w-10 h-10 text-red-500 shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="text-black text-sm font-semibold">
                            Rent Overdue: {rent.tenant?.name || "N/A"}
                          </p>
                          <p className="text-gray-600 text-sm">
                            ₹{rent.remaining.toLocaleString()} due •{" "}
                            {daysOverdue} day
                            {daysOverdue !== 1 ? "s" : ""} overdue
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Button
                            className="bg-gray-50 text-black hover:bg-black hover:text-white"
                            onClick={() => navigate("/rent-payment")}
                          >
                            Pay Now
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No overdue rents
                  </p>
                )}

                {upcomingRents.length > 0 &&
                  upcomingRents.map((rent, idx) => {
                    return (
                      <div
                        key={rent._id || idx}
                        className="flex gap-3 bg-blue-50 p-4 rounded-md border border-blue-200"
                      >
                        <CalendarDaysIcon className="w-10 h-10 text-blue-500 shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="text-black text-sm font-semibold">
                            Rent Due Soon: {rent.tenant?.name || "N/A"}
                          </p>
                          <p className="text-gray-600 text-sm">
                            ₹{rent.remaining.toLocaleString()} due in{" "}
                            {rent.daysUntilDue} day
                            {rent.daysUntilDue !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Button
                            className="bg-gray-50 text-black hover:bg-black hover:text-white"
                            onClick={() => navigate("/rent-payment")}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                {contractsEndingSoon.length > 0 &&
                  contractsEndingSoon.map((tenant, idx) => {
                    return (
                      <div
                        key={tenant._id || idx}
                        className="flex gap-3 bg-yellow-50 p-4 rounded-md border border-yellow-200"
                      >
                        <CalendarDaysIcon className="w-10 h-10 text-yellow-600 shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="text-black text-sm font-semibold">
                            Contract Ending: {tenant.name}
                          </p>
                          <p className="text-gray-600 text-sm">
                            Contract ending in {tenant.daysUntilEnd} day
                            {tenant.daysUntilEnd !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Button
                            className="bg-gray-50 text-black hover:bg-black hover:text-white"
                            onClick={() => navigate("/tenant/tenants")}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                {overdueRents.length === 0 &&
                  upcomingRents.length === 0 &&
                  contractsEndingSoon.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">
                      No upcoming deadlines
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Building Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-600">Occupancy</p>
                    <p className="text-sm font-semibold">{occupancyRate}%</p>
                  </div>
                  <Progress value={occupancyRate} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-600">Rent Collection</p>
                    <p className="text-sm font-semibold">
                      {totalDue > 0
                        ? Math.round((monthlyRevenue / totalDue) * 100)
                        : 0}
                      %
                    </p>
                  </div>
                  <Progress
                    value={totalDue > 0 ? (monthlyRevenue / totalDue) * 100 : 0}
                    className="h-2"
                  />
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Total Units</p>
                    <p className="text-sm font-semibold">{totalUnits}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Occupied</p>
                    <p className="text-sm font-semibold text-green-600">
                      {occupiedUnits}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Vacant</p>
                    <p className="text-sm font-semibold text-gray-400">
                      {totalUnits - occupiedUnits}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Total Tenants</p>
                    <p className="text-sm font-semibold">{totalTenants}</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-sm font-semibold">
                      ₹{monthlyRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Total Due</p>
                    <p className="text-sm font-semibold text-orange-600">
                      ₹{totalRentDue.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-sm font-semibold text-red-600">
                      ₹{(rentSummary.totalPending || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
