"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardListIcon,
  XIcon,
  ImageIcon,
  FileIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormik } from "formik";
import { Separator } from "@/components/ui/separator";
import DualCalendarTailwind from "./components/dualDate";
import "nepali-datepicker-reactjs/dist/index.css";
import api from "../plugins/axios";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
function AddTenants() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [activeTab, setActiveTab] = useState("personalInfo");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
    };
    const fetchProperties = async () => {
      try {
        const response = await api.get(
          "http://localhost:3000/api/property/get-property"
        );
        const data = await response.data;
        setProperties(data.property || []);
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };
    fetchProperties();
    getUnits();
  }, []);

  // Helper function to get innerBlocks for selected block
  const getInnerBlocksForBlock = (blockId) => {
    if (!blockId || !properties || properties.length === 0) return [];

    for (const property of properties) {
      if (property.blocks && property.blocks.length > 0) {
        const selectedBlock = property.blocks.find(
          (block) => block._id === blockId
        );
        if (selectedBlock && selectedBlock.innerBlocks) {
          return selectedBlock.innerBlocks;
        }
      }
    }
    return [];
  };

  // Memoize innerBlocks based on selected block

  // Helper function to get property ID from selected block
  const getPropertyIdFromBlock = (blockId) => {
    if (!blockId || !properties || properties.length === 0) return null;

    for (const property of properties) {
      if (property.blocks && property.blocks.length > 0) {
        const selectedBlock = property.blocks.find(
          (block) => block._id === blockId
        );
        if (selectedBlock) {
          return property._id;
        }
      }
    }
    return null;
  };

  const formik = useFormik({
    initialValues: {
      name: "",
      unitNumber: "",
      phone: "",
      email: "",
      address: "",
      leaseStartDate: "",
      leaseEndDate: "",
      block: "",
      innerBlock: "",
      documentType: "",
      documents: {}, // Store files grouped by document type: { documentType: [files] }
      dateOfAgreementSigned: "",
      leasedSquareFeet: "",
      pricePerSqft: "",
      camRatePerSqft: "",
      securityDeposit: "",
      status: "",
      keyHandoverDate: "",
      spaceHandoverDate: "",
      spaceReturnedDate: "",
    },
    // Update the onSubmit function in your formik configuration

    onSubmit: async (values) => {
      try {
        setIsLoading(true);
        // Validate lease end date is after lease start date
        if (values.leaseStartDate && values.leaseEndDate) {
          if (new Date(values.leaseEndDate) < new Date(values.leaseStartDate)) {
            toast.error("Lease end date must be after lease start date");
            return;
          }
        }

        const formData = new FormData();

        const propertyId = getPropertyIdFromBlock(values.block);
        if (!propertyId) {
          toast.error("Please select a valid block");
          return;
        }

        // Add all form fields except files and documents
        Object.entries(values).forEach(([key, value]) => {
          if (
            key !== "documents" &&
            key !== "documentType" &&
            key !== "spaceHandoverDate" &&
            key !== "spaceReturnedDate"
          ) {
            if (value !== null && value !== "" && value !== undefined) {
              formData.append(key, value);
            }
          }
        });

        // Handle optional date fields
        if (values.spaceHandoverDate && values.spaceHandoverDate !== "") {
          formData.append("spaceHandoverDate", values.spaceHandoverDate);
        }
        if (values.spaceReturnedDate && values.spaceReturnedDate !== "") {
          formData.append("spaceReturnedDate", values.spaceReturnedDate);
        }

        // Map document types to backend field names
        const fieldMapping = {
          tenantPhoto: "citizenShip",
          leaseAgreement: "pdfAgreement",
          other: "image",
        };

        // Track what file types we have
        let hasRequiredFiles = {
          image: false,
          pdfAgreement: false,
          citizenShip: false,
        };

        // Process documents and append to FormData with correct field names
        if (values.documents && Object.keys(values.documents).length > 0) {
          Object.entries(values.documents).forEach(([docType, files]) => {
            const backendFieldName = fieldMapping[docType];

            if (backendFieldName && files && files.length > 0) {
              files.forEach((file) => {
                formData.append(backendFieldName, file);
                hasRequiredFiles[backendFieldName] = true;
              });
            }
          });
        }

        // Validate required files
        if (!hasRequiredFiles.image || !hasRequiredFiles.pdfAgreement) {
          toast.error("Please upload at least one image and one PDF agreement");
          return;
        }

        formData.append("property", propertyId);

        const res = await api.post("/api/tenant/create-tenant", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (res.data.success) {
          toast.success("Tenant created successfully!");
          formik.resetForm();
          handleClose();
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error creating tenant:", error);
        console.error("Error response:", error?.response?.data);

        // Handle validation errors
        if (error?.response?.data?.errors) {
          const validationErrors = error.response.data.errors;
          let errorMessages = [];

          if (Array.isArray(validationErrors)) {
            errorMessages = validationErrors;
          } else if (typeof validationErrors === "object") {
            errorMessages = Object.entries(validationErrors).map(
              ([field, messages]) => {
                if (Array.isArray(messages)) {
                  return messages.map((msg) => `${field}: ${msg}`).join(", ");
                }
                return `${field}: ${messages}`;
              }
            );
          }

          const errorText =
            errorMessages.length > 0
              ? errorMessages.join("; ")
              : JSON.stringify(validationErrors);

          toast.error(errorText || "Validation failed");
        } else {
          const errorMessage =
            error?.response?.data?.message || "Failed to create tenant";
          toast.error(errorMessage);
        }
      }
    },
  });
  const innerBlocks = useMemo(() => {
    return getInnerBlocksForBlock(formik.values.block);
  }, [formik.values.block, properties]);

  function handleClose() {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  }

  const tabs = [
    "personalInfo",
    "leaseInfo",
    "propertyDetails",
    "documents",
    "financials",
  ];

  const handleNext = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };
  const totalFields = Object.keys(formik.initialValues).length;
  const filledFields = Object.values(formik.values).filter(
    (value) =>
      value !== "" &&
      value !== null &&
      (typeof value !== "object" || Object.keys(value).length > 0)
  ).length;
  const completionRate = Math.round((filledFields / totalFields) * 100);
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ClipboardListIcon className="w-8 h-8 text-primary" />
            New Tenant Registration
          </h1>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors bg-transparent"
            onClick={handleClose}
          >
            <XIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Completion Progress */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-1">
            Completion: {completionRate}%
          </Label>
          <Progress value={completionRate} className="h-3 rounded-full" />
        </div>

        <form onSubmit={formik.handleSubmit}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personalInfo">Personal Info</TabsTrigger>
              <TabsTrigger value="leaseInfo">Lease Info</TabsTrigger>
              <TabsTrigger value="propertyDetails">Property</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>

            {/* ------------------ Personal Info ------------------ */}
            <TabsContent value="personalInfo" className="mt-4">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <Label>Full Name</Label>
                  <Input
                    name="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    placeholder="John Doe"
                  />
                  <Label>Contact Number</Label>
                  <Input
                    name="phone"
                    value={formik.values.phone}
                    onChange={formik.handleChange}
                    placeholder="+977-9800000000"
                  />
                  <Label>Email Address</Label>
                  <Input
                    name="email"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    placeholder="john.doe@example.com"
                  />
                  <Label>Address</Label>
                  <Input
                    name="address"
                    value={formik.values.address}
                    onChange={formik.handleChange}
                    placeholder="Enter Address"
                  />
                  <Label>Unit Number</Label>
                  <Select
                    name="unitNumber"
                    value={formik.values.unitNumber}
                    onValueChange={(value) =>
                      formik.setFieldValue("unitNumber", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit._id} value={unit._id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end mt-6">
                    <Button type="button" onClick={handleNext}>
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ------------------ Lease Info ------------------ */}
            <TabsContent value="leaseInfo" className="mt-4 space-y-5">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <Label>Lease Start Date</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue("leaseStartDate", englishDate);
                    }}
                  />
                  <Label>Lease End Date</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue("leaseEndDate", englishDate);
                    }}
                  />
                  {formik.values.leaseStartDate &&
                    formik.values.leaseEndDate &&
                    new Date(formik.values.leaseEndDate) <
                      new Date(formik.values.leaseStartDate) && (
                      <p className="text-red-500 text-sm mt-1">
                        Lease end date must be after start date
                      </p>
                    )}
                  <Label>Key Handover Date</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue("keyHandoverDate", englishDate);
                    }}
                  />
                  <Label>Space Handover Date</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue("spaceHandoverDate", englishDate);
                    }}
                  />
                  <Label>Space Returned Date (Optional)</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue("spaceReturnedDate", englishDate);
                    }}
                  />
                  <div className="flex justify-between mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                    <Button type="button" onClick={handleNext}>
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ------------------ Property Details ------------------ */}
            <TabsContent value="propertyDetails" className="mt-4 space-y-5">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <Label>Building</Label>
                  <Select
                    name="block"
                    value={formik.values.block}
                    onValueChange={(value) => {
                      formik.setFieldValue("block", value);
                      formik.setFieldValue("innerBlock", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select block" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.flatMap((property) =>
                        property.blocks.map((block) => (
                          <SelectItem key={block._id} value={block._id}>
                            {block.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Label>Block</Label>
                  <Select
                    name="innerBlock"
                    value={formik.values.innerBlock}
                    onValueChange={(value) =>
                      formik.setFieldValue("innerBlock", value)
                    }
                    disabled={!formik.values.block}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select inner block" />
                    </SelectTrigger>
                    <SelectContent>
                      {innerBlocks.map((ib) => (
                        <SelectItem key={ib._id} value={ib._id}>
                          {ib.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-between mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                    <Button type="button" onClick={handleNext}>
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ------------------ Documents ------------------ */}
            <TabsContent value="documents" className="mt-4 space-y-5">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <Label>Document Type</Label>
                  <Select
                    name="documentType"
                    value={formik.values.documentType || ""}
                    onValueChange={(value) =>
                      formik.setFieldValue("documentType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenantPhoto">Citizenship</SelectItem>
                      <SelectItem value="leaseAgreement">Agreement</SelectItem>
                      <SelectItem value="other">Photo</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>Upload Document</Label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const currentFiles =
                        formik.values.documents?.[formik.values.documentType] ||
                        [];
                      formik.setFieldValue("documents", {
                        ...formik.values.documents,
                        [formik.values.documentType]: [
                          ...currentFiles,
                          ...files,
                        ],
                      });
                    }}
                  />

                  {/* Show uploaded files */}
                  {formik.values.documents &&
                    Object.entries(formik.values.documents).map(
                      ([type, files]) => (
                        <div key={type}>
                          <Badge>{type}</Badge>
                          <ul>
                            {files.map((file, i) => (
                              <li key={i}>{file.name}</li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}

                  <Label>Agreement Signed Date</Label>
                  <DualCalendarTailwind
                    onChange={(englishDate) => {
                      formik.setFieldValue(
                        "dateOfAgreementSigned",
                        englishDate
                      );
                    }}
                  />
                  <div className="flex justify-between mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                    <Button type="button" onClick={handleNext}>
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ------------------ Financials ------------------ */}
            <TabsContent value="financials" className="mt-4 space-y-5">
              <Card className="shadow-lg">
                <CardContent className="p-6 space-y-5">
                  <Label>Leased Square Feet</Label>
                  <Input
                    type="number"
                    name="leasedSquareFeet"
                    value={formik.values.leasedSquareFeet}
                    onChange={formik.handleChange}
                  />
                  <Label>Price Per Sqft (₹)</Label>
                  <Input
                    type="number"
                    name="pricePerSqft"
                    value={formik.values.pricePerSqft}
                    onChange={formik.handleChange}
                  />
                  <Label>CAM Rate Per Sqft (₹)</Label>
                  <Input
                    type="number"
                    name="camRatePerSqft"
                    value={formik.values.camRatePerSqft}
                    onChange={formik.handleChange}
                  />
                  <Label>Security Deposit (₹)</Label>
                  <Input
                    type="number"
                    name="securityDeposit"
                    value={formik.values.securityDeposit}
                    onChange={formik.handleChange}
                  />
                  <Label>Status</Label>
                  <Select
                    name="status"
                    value={formik.values.status}
                    onValueChange={(value) =>
                      formik.setFieldValue("status", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="vacated">Vacated</SelectItem>
                    </SelectContent>
                  </Select>

                  <Separator />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary/90"
                      disabled={isLoading}
                    >
                      {isLoading ? <Spinner /> : "Save & Register"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleClose}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </div>
    </div>
  );
}
export default AddTenants;
