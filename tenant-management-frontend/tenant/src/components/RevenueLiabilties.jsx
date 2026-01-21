import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
// Nepali months (6 months example: Ashwin to Falgun)
const revenueLiabilitiesData = [
    { month: "Ashwin", revenue: 500000, liabilities: 200000 },
    { month: "Kartik", revenue: 600000, liabilities: 250000 },
    { month: "Mangsir", revenue: 550000, liabilities: 220000 },
    { month: "Poush", revenue: 650000, liabilities: 300000 },
    { month: "Magh", revenue: 700000, liabilities: 280000 },
    { month: "Falgun", revenue: 750000, liabilities: 350000 },
  ];
  
export default function RevenueLiabilitiesChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue vs Liabilities (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueLiabilitiesData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--green-500))"
 radius={[4, 4, 0, 0]} 
 className="text-green-500"
 />
                <Bar dataKey="liabilities" fill="hsl(var(--red-500))" radius={[4, 4, 0, 0]} 
                className="text-red-500"
                />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
