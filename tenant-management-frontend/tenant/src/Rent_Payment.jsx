import React from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import api from "../plugins/axios";
import NepaliDate from "nepali-datetime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const statusVariant = {
  Paid: "success",
  paid: "success",
  Overdue: "destructive",
  overdue: "destructive",
  "Due Now": "warning",
  "due now": "warning",
  pending: "secondary",
  Pending: "secondary",
};

// Helper function to format Nepali due date from rent object
const formatNepaliDueDate = (rent) => {
  try {
    // Priority 1: Use nepaliDueDate if available (already in Nepali BS format)
    if (rent.nepaliDueDate) {
      const nepaliDateStr = rent.nepaliDueDate.split("T")[0]; // Extract YYYY-MM-DD
      const [year, month, day] = nepaliDateStr.split("-").map(Number);

      // Check if year is in Nepali range (BS years are typically 2000+)
      if (year > 2000) {
        // This is already a Nepali date, create NepaliDate object
        // Try with 1-indexed month first (most date libraries use this)
        try {
          const nepaliDate = new NepaliDate(year, month, day);
          return nepaliDate.format("YYYY-MMM-DD");
        } catch (e) {
          // If that fails, try with 0-indexed month
          const nepaliDate = new NepaliDate(year, month - 1, day);
          return nepaliDate.format("YYYY-MMM-DD");
        }
      }
    }

    // Priority 2: Use nepaliMonth and nepaliYear if available
    if (rent.nepaliMonth && rent.nepaliYear) {
      // Create NepaliDate directly from Nepali date components
      try {
        const nepaliDate = new NepaliDate(rent.nepaliYear, rent.nepaliMonth, 1);
        return nepaliDate.format("YYYY-MMM");
      } catch (e) {
        // If that fails, try with 0-indexed month
        const nepaliDate = new NepaliDate(
          rent.nepaliYear,
          rent.nepaliMonth - 1,
          1
        );
        return nepaliDate.format("YYYY-MMM");
      }
    }

    // Priority 3: Convert from English month and year
    if (rent.month && rent.year) {
      const dateStr = `${rent.year}-${String(rent.month).padStart(2, "0")}-01`;
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    // Priority 4: Use englishDueDate if available
    if (rent.englishDueDate) {
      const dateStr = rent.englishDueDate.split("T")[0]; // Extract YYYY-MM-DD
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    return "N/A";
  } catch (error) {
    console.error("Error converting date to Nepali:", error);
    // Fallback: show available date info
    if (rent.nepaliDueDate) {
      const dateStr = rent.nepaliDueDate.split("T")[0];
      return dateStr; // Return raw date string as fallback
    }
    if (rent.nepaliMonth && rent.nepaliYear) {
      return `${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`;
    }
    if (rent.month && rent.year) {
      return `${rent.month}/${rent.year}`;
    }
    return "N/A";
  }
};

export default function RentDashboard() {
  const [rents, setRents] = useState([]);
  const [units, setUnits] = useState([]);

  const getRents = async () => {
    const response = await api.get("/api/rent/get-rents");
    setRents(response.data.rents);
    console.log(response.data.rents);
  };

  useEffect(() => {
    getRents();
  }, []);
  useEffect(() => {
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
      console.log(response.data.units);
    };
    getUnits();
  }, []);

  console.log(units);

  // Calculate totals from actual data
  const totalCollected = rents.reduce(
    (sum, rent) => sum + (rent.paidAmount || 0),
    0
  );
  const totalDue = rents.reduce((sum, rent) => sum + (rent.rentAmount || 0), 0);

  return (
    <>
      <div className="mb-6">
        <p className="text-2xl font-bold">Rent & Payments</p>
        <p className="text-gray-500 text-sm">Track monthly rent collection</p>
      </div>

      <Card className="max-w-5xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Rent & Payments</CardTitle>
          <CardDescription>Track monthly rent collection</CardDescription>
          <div className="mt-2 text-sm text-muted-foreground">
            <strong>Total Collected:</strong>{" "}
            <span className="text-primary">
              ₹{totalCollected.toLocaleString()} / ₹{totalDue.toLocaleString()}
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant / Unit</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rents.map((rent, idx) => (
                <TableRow key={rent._id || idx}>
                  <TableCell>
                    <div className="font-medium">
                      {rent.tenant ? rent.tenant.name : "No Tenant Assigned"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {rent.innerBlock?.name || "N/A"} -{" "}
                      {rent.block?.name || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    ₹{rent.rentAmount?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell>{formatNepaliDueDate(rent)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[rent.status] || "default"}>
                      {rent.status || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-800 hover:text-white"
                        >
                          Record Payment
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          {" "}
                          <DialogTitle className="text-2xl font-bold">
                            Record Payment
                          </DialogTitle>
                          <div className="bg-gray-100 p-4 rounded-md mt-4">
                            <p className="text-gray-500">Receiving From:</p>
                            <p className="text-black font-bold text-xl">
                              {rent.tenant?.name || "N/A"}
                            </p>
                            {console.log(rent.tenant?.units)}
                            <p className="text-gray-500">
                              {" "}
                              {rent.tenant?.unitNumber
                                ? rent.tenant.unitNumber
                                : rent.tenant.units
                                    ?.map((unit) => unit.name)
                                    .join(", ")}
                            </p>
                          </div>
                          <div>
                            <p className="mb-2">Amount Received:</p>
                            <Input placeholder="" />
                          </div>
                          <div>
                            <p className="mb-2">Payment Method:</p>
                            <div className="w-50">
                              <div className="flex justify-between">
                                <Select className="w-50">
                                  <SelectTrigger>
                                    <SelectValue placeholder="Bank" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bank">
                                      Siddhartha Bank
                                    </SelectItem>
                                    <SelectItem value="Bank">
                                      Nepal Bank
                                    </SelectItem>
                                    <SelectItem value="Bank">
                                      Prabhu Bank
                                    </SelectItem>
                                    <SelectItem value="Bank">
                                      Rastriya Banijya Bank
                                    </SelectItem>
                                    <SelectItem value="Bank">
                                      Siddhartha Bank
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select className="w-50">
                                  <SelectTrigger>
                                    <SelectValue placeholder="cheque" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Cheque">
                                      Siddhartha Bank
                                    </SelectItem>
                                    <SelectItem value="Cheque">
                                      Nepal Bank
                                    </SelectItem>
                                    <SelectItem value="Cheque">
                                      Prabhu Bank
                                    </SelectItem>
                                    <SelectItem value="Cheque">
                                      Rastriya Banijya Bank
                                    </SelectItem>
                                    <SelectItem value="Cheque">
                                      Siddhartha Bank
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="mb-2">Notes(Optional)</p>
                            <Textarea placeholder="" />
                          </div>
                        </DialogHeader>
                        <div className="flex justify-between">
                          <DialogFooter>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-gray-200 text-black hover:bg-gray-200 w-50"
                              onClick={() => {}}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-800 hover:text-white w-50"
                              onClick={() => {}}
                            >
                              Confirm Payment
                            </Button>
                          </DialogFooter>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
