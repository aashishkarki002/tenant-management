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
import DualCalendarTailwind from "./components/dualDate";
import { useFormik } from "formik";
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
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
const statusStyles = {
  paid: "bg-green-100 text-green-800 border-green-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
  partial: "bg-orange-100 text-orange-800 border-orange-300",
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
          const nepaliDate = new NepaliDate(year, month - 1, day);
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
    if (rent.nepaliMonth - 1 && rent.nepaliYear) {
      return `${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`;
    }
    if (rent.month - 1 && rent.year) {
      return `${rent.month}/${rent.year}`;
    }
    return "N/A";
  }
};
export default function RentDashboard() {
  const [rents, setRents] = useState([]);
  const [units, setUnits] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(["", ""]);
  const normalizeStatus = (status = "") => status.toLowerCase();
  const GetBankAccounts = async () => {
    const response = await api.get("/api/bank/get-bank-accounts");
    const data = await response.data;
    setBankAccounts(data.bankAccounts);
  };
  const getRents = async () => {
    const response = await api.get("/api/rent/get-rents");
    setRents(response.data.rents);
  };

  useEffect(() => {
    getRents();
    GetBankAccounts();
  }, []);
  useEffect(() => {
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
    };
    getUnits();
  }, []);
  const statusVariant = (status = "") => statusStyles[normalizeStatus(status)];
  // Calculate totals from actual data
  const totalCollected = rents.reduce(
    (sum, rent) => sum + (rent.paidAmount || 0),
    0
  );
  const totalDue = rents.reduce((sum, rent) => sum + (rent.rentAmount || 0), 0);

  const formik = useFormik({
    initialValues: {
      rentId: "",
      paymentDate: null,
      paymentMethod: selectedPaymentMethod,
      bankAccountId: "",
      amount: 0,
      notes: "",
      receivedBy: "",
    },
    onSubmit: async (values) => {
      console.log(values);
      const response = await api.post("/api/payment/pay-rent", values);
      if (response.data.success) {
        toast.success(response.data.message);
        formik.resetForm();
        getRents();
      } else {
        toast.error(response.data.message);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    formik.handleSubmit();
  };
  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card className="w-full sm:max-w-5xl mx-auto mt-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Rent & Payments
            </CardTitle>
            <CardDescription className="text-gray-500 text-sm">
              Track monthly rent collection
            </CardDescription>
            <div className="mt-2 text-sm text-muted-foreground">
              <strong>Total Collected:</strong>{" "}
              <span className="text-primary">
                ₹{totalCollected.toLocaleString()} / ₹
                {totalDue.toLocaleString()}
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
                        {rent.tenant?.units
                          ?.map((unit) => unit.name)
                          .join(", ")}{" "}
                        - {rent.tenant?.unitNumber || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      ₹{rent.rentAmount?.toLocaleString() || "0"}
                    </TableCell>
                    <TableCell>{formatNepaliDueDate(rent)}</TableCell>
                    <TableCell>
                      {(() => {
                        const status = normalizeStatus(rent.status);

                        return (
                          <Badge
                            className={`capitalize border ${
                              statusStyles[status] ||
                              "bg-gray-100 text-gray-700 border-gray-300"
                            }`}
                          >
                            {status === "partial" ? "Partially Paid" : status}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rent.status === "paid"}
                            className="bg-gray-500 text-white hover:bg-gray-800 hover:text-white"
                            onClick={() => {
                              formik.setFieldValue(
                                "rentId",
                                rent._id.toString()
                              );
                              formik.setFieldValue(
                                "amount",
                                rent.rentAmount || 0
                              );
                              formik.setFieldValue("paymentDate", null);
                            }}
                          >
                            {rent.status === "paid"
                              ? "Paid"
                              : "Record Payment "}
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
                              <Input
                                placeholder=""
                                value={formik.values.amount}
                                onChange={formik.handleChange}
                                name="amount"
                              />
                            </div>
                            <div>
                              <p className="mb-2">Payment Date:</p>
                              <DualCalendarTailwind
                                onChange={(english, nepali) => {
                                  // Create Date object directly from Nepali date (e.g., "2082-09-20")
                                  // Don't convert to English date - parse Nepali date directly
                                  if (nepali) {
                                    const [year, month, day] = nepali
                                      .split("-")
                                      .map(Number);
                                    const dateObj = new Date(
                                      year,
                                      month - 1,
                                      day
                                    );
                                    formik.setFieldValue(
                                      "paymentDate",
                                      dateObj
                                    );
                                  } else {
                                    formik.setFieldValue("paymentDate", null);
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <p className="mb-2">Payment Method:</p>
                              <div className="w-full sm:w-50">
                                <div className="flex gap-2">
                                  <Select
                                    className="w-full sm:w-50"
                                    value={formik.values.paymentMethod}
                                    onValueChange={(value) =>
                                      formik.setFieldValue(
                                        "paymentMethod",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select Payment Method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="bank_transfer">
                                        Bank
                                      </SelectItem>
                                      <SelectItem value="cash">Cash</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    className="w-full sm:w-50"
                                    disabled={
                                      formik.values.paymentMethod !==
                                      "bank_transfer"
                                    }
                                    value={formik.values.bankAccountId}
                                    onValueChange={(value) =>
                                      formik.setFieldValue(
                                        "bankAccountId",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {bankAccounts.map((bank) => (
                                        <SelectItem
                                          key={bank._id}
                                          value={bank._id}
                                        >
                                          {bank.bankName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="mb-2">Notes(Optional)</p>
                              <Textarea
                                placeholder=""
                                value={formik.values.notes}
                                onChange={formik.handleChange}
                                name="notes"
                              />
                            </div>
                          </DialogHeader>

                          <DialogFooter>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-gray-200 text-black hover:bg-gray-200 w-full sm:w-50"
                              onClick={() => {
                                formik.resetForm();
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-800 hover:text-white w-50"
                              onClick={(e) => {
                                e.preventDefault();
                                formik.handleSubmit();
                              }}
                            >
                              Confirm Payment
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
