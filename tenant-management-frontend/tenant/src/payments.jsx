import React, { useState, useEffect } from "react";
import api from "../plugins/axios";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import {
  Building2Icon,
  LightbulbIcon,
  Zap,
  Download,
  Link2,
  Mail,
  Eye,
  Share2,
  Check,
  FileText,
} from "lucide-react";
export default function payments() {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [property, setProperty] = useState(null);
  const [propertyId, setPropertyId] = useState(null);
  const handleDownloadPDF = () => {
    console.log("Downloading PDF");
  };
  useEffect(() => {
    const getpayment = async () => {
      const res = await api.get(`api/payment/get-payment-by-id/${id}`);
      setPayment(res.data.data);
    };

    getpayment();
  }, [id]);
  console.log(payment);
  return (
    <>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col w-full flex-2 ">
          <div className="w-full ">
            <Card className="w-full mt-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl font-bold">
                      Payment Details
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      Unique Transaction ID: {id}
                    </p>
                  </div>
                  <div className="">
                    <Badge className="bg-green-50 text-green-600 border-green-600 h-8 w-20">
                      <LightbulbIcon className="w-10 h-10 mr-2" />
                      verified
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
          <div className="w-full ">
            <Card className=" mt-6">
              <CardHeader>
                <div className="flex justify-between ">
                  <div className="flex flex-row items-center justify-between w-full ">
                    <Building2Icon className="w-10 h-10 mr-2 text-white bg-blue-200 rounded-md p-2" />
                    <div>
                      {" "}
                      <CardTitle className="text-2xl font-bold">
                        {payment?.rent?.property?.name}{" "}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">
                        kathmandu,Nepal
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground ml-auto">
                      <p className="text-sm text-black font-bold text-right mb-2">
                        Official Receipt
                      </p>
                      {payment?.receipt?.publicId}
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
              </CardHeader>
              <div className="flex flex-row gap-4">
                <div>
                  <CardContent>
                    <p className=" font-semibold">TENANT INFORMATION</p>
                    <div className="flex gap-30 ">
                      <div className="">
                        <p className="text-gray-500 text-sm mt-2">Full Name:</p>
                        <p>{payment?.rent?.tenant?.name}</p>
                        <p className="text-gray-500 text-sm mt-2">
                          Phone Number:{" "}
                        </p>
                        <p>{payment?.rent?.tenant?.phoneNumber}</p>
                      </div>
                      <div className="">
                        <p className="text-gray-500 text-sm mt-2">
                          Unit number:{" "}
                        </p>
                        <p>{payment?.rent?.tenant?.units?.name} unit 404</p>
                      </div>
                    </div>
                  </CardContent>
                </div>
                <div>
                  <CardContent>
                    <p className=" font-semibold ">TRANSACTION DETAILS</p>
                    <div className="flex gap-20">
                      <div className="">
                        <p className="text-gray-500 text-sm mt-2">Date AD :</p>
                        <p>{payment?.paymentDate}</p>
                        <p className="text-gray-500 text-sm mt-2">
                          BankName_Type:{" "}
                        </p>
                        <p>{payment?.bankAccount?.bankName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mt-2">Date BS :</p>
                        <p> {payment?.nepaliDate}</p>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-between ml-4 mr-4">
                <div>
                  <p className="text-gray-500 font-semibold text-lg">
                    TOTAL AMOUNT PAID
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-3xl font-bold">
                    ₹ {payment?.amount?.toLocaleString()}
                  </p>
                  <p className="text-black text-sm mt-1">
                    {payment?.amount?.toLocaleString()} Rupees Only
                  </p>
                </div>
              </div>
              <div className=" p-3 rounded-lg mt-6 ml-4 mr-4">
                <h2 className="text-black text-lg font-semibold mb-8">
                  VERIFICATION LIFECYCLE
                </h2>
                <div className="relative flex items-center justify-between">
                  {/* Connecting Line */}
                  <div className="absolute top-6 left-0 right-0 h-0.5 bg-black"></div>

                  {/* Stage 1: Payment Initiated */}
                  <div className="relative flex flex-col items-center z-10">
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mb-3">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-black text-sm font-medium">
                      Payment Initiated
                    </p>
                    <p className="text-black text-xs mt-1">
                      {payment?.paymentInitiatedDate} 12 Oct, 10:20 AM
                    </p>
                  </div>

                  {/* Stage 2: Bank Verified */}
                  <div className="relative flex flex-col items-center z-10">
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mb-3">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-black text-sm font-medium">
                      Bank Verified
                    </p>
                    <p className="text-black text-xs mt-1">
                      {payment?.bankVerifiedDate} 12 Oct, 11:40 AM
                    </p>
                  </div>

                  {/* Stage 3: Receipt Generated */}
                  <div className="relative flex flex-col items-center z-10">
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-black text-sm font-medium">
                      Receipt Generated
                    </p>
                    <p className="text-black text-xs mt-1">
                      {payment?.receiptGeneratedDate} 12 Oct, 12:00 PM
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between">
                  <div>
                    <p className=" font-semibold ">NOTES/REMARKS</p>
                    <p className="text-gray-500 text-sm mt-2">
                      {payment?.notes}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold mt-2"> AUTHORIZED BY </p>
                    <Separator className="my-4" />
                    <p className="text-gray-500 font-semibold mt-2">
                      {payment?.createdBy?.name} Utshaha shrestha
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        <div className="w-full flex-1">
          <Card className="mt-6">
            <CardContent className="pt-6">
              {/* Quick Actions Section */}
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <Zap className="w-5 h-5 mr-2" />
                  <h3 className="text-lg font-semibold">Quick Actions</h3>
                </div>
                <div className="space-y-3">
                  <Button className="w-[96%] justify-start" variant="default">
                    <Download
                      cursor-pointer
                      className="w-4 h-4 mr-2"
                      onClick={() => handleDownloadPDF()}
                    />
                    Download PDF Receipt
                  </Button>
                  <Button className="w-[96%] justify-start" variant="outline">
                    <Link2 className="w-4 h-4 mr-2" />
                    Copy Payment Link
                  </Button>
                  <Button className="w-[96%] justify-start" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Email Receipt
                  </Button>
                </div>
              </div>

              {/* History Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">HISTORY</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Viewed by Admin</p>
                      <p className="text-sm text-muted-foreground">
                        2 mins ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Shared with Tenants</p>
                      <p className="text-sm text-muted-foreground">
                        1 hour ago
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
