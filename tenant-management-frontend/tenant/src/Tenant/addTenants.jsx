
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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormik } from "formik";
import { Separator } from "@/components/ui/separator";
import DualCalendarTailwind from "../components/dualDate";
import "nepali-datepicker-reactjs/dist/index.css";
import api from "../../plugins/axios";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Combobox, ComboboxTrigger, ComboboxContent, ComboboxItem, ComboboxValue, ComboboxList } from "@/components/ui/combobox.jsx";

import useUnits from "../hooks/use-units";
import useProperty from "../hooks/use-property";
function AddTenants() {

  const { units } = useUnits();
  const { property } = useProperty();
  const [activeTab, setActiveTab] = useState("personalInfo");
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to get innerBlocks for selected block
  const getInnerBlocksForBlock = (blockId) => {
    if (!blockId || !property || property.length === 0) return [];

    for (const propertyItem of property) {
      if (propertyItem.blocks && propertyItem.blocks.length > 0) {
        const selectedBlock = propertyItem.blocks.find(
          (block) => block._id === blockId
        );
        if (selectedBlock && selectedBlock.innerBlocks) {
          return selectedBlock.innerBlocks;
        }
      }
    }
    return [];
  };

  // Helper function to get property ID from selected block
  const getPropertyIdFromBlock = (blockId) => {
    if (!blockId || !property || property.length === 0) return null;

    for (const propertyItem of property) {
      if (propertyItem.blocks && propertyItem.blocks.length > 0) {
        const selectedBlock = propertyItem.blocks.find(
          (block) => block._id === blockId
        );
        if (selectedBlock) {
          return propertyItem._id;
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
      paymentMethod: "",
      bankGuaranteePhoto: null,
      chequeAmount: "",
      chequeNumber: "",
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

        // Validate payment method specific fields
        if (values.paymentMethod === "bank_guarantee" && !values.bankGuaranteePhoto) {
          toast.error("Please upload bank guarantee photo");
          return;
        }

        if (values.paymentMethod === "cheque") {
          if (!values.chequeAmount || !values.chequeNumber) {
            toast.error("Please provide cheque amount and cheque number");
            return;
          }
        }

        const formData = new FormData();

        const propertyId = getPropertyIdFromBlock(values.block);
        if (!propertyId) {
          toast.error("Please select a valid block");
          return;
        }

        // Handle unitNumber array separately - convert to units field
        if (values.unitNumber && Array.isArray(values.unitNumber) && values.unitNumber.length > 0) {
          values.unitNumber.forEach((unitId) => {
            formData.append("units", unitId);
          });
        }

        // Add all form fields except files and documents
        Object.entries(values).forEach(([key, value]) => {
          if (
            key !== "documents" &&
            key !== "documentType" &&
            key !== "unitNumber" && // Exclude unitNumber as it's handled above
            key !== "spaceHandoverDate" &&
            key !== "spaceReturnedDate" &&
            key !== "bankGuaranteePhoto"
          ) {
            if (value !== null && value !== "" && value !== undefined) {
              // Handle arrays properly
              if (Array.isArray(value)) {
                value.forEach((item) => {
                  formData.append(key, item);
                });
              } else {
                formData.append(key, value);
              }
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

        // Handle bank guarantee photo
        if (values.bankGuaranteePhoto) {
          formData.append("bankGuaranteePhoto", values.bankGuaranteePhoto);
        }

        // Map document types (from UI) to backend field names
        // NOTE:
        // - "tenantPhoto" is treated as citizenship document
        // - "leaseAgreement" is treated as PDF agreement
        // - "photo" is treated as a general image
        // - "companyDocument" and "tds" are sent as "other" docs,
        //   which the backend accepts and counts as valid documents
        const fieldMapping = {
          tenantPhoto: "citizenShip",
          leaseAgreement: "pdfAgreement",
          photo: "image",
          companyDocument: "other",
          tds: "other",
        };

        // Track if we have at least one document to satisfy backend requirement
        let hasAnyDocument = false;

        // Process documents and append to FormData with correct field names
        if (values.documents && Object.keys(values.documents).length > 0) {
          Object.entries(values.documents).forEach(([docType, files]) => {
            const backendFieldName = fieldMapping[docType];

            if (backendFieldName && files && files.length > 0) {
              files.forEach((file) => {
                formData.append(backendFieldName, file);
                hasAnyDocument = true;
              });
            }
          });
        }

        // Let backend enforce detailed rules, but ensure at least one doc is selected
        if (!hasAnyDocument) {
          toast.error("Please upload at least one document");
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
        setIsLoading(false);
      }
    },
  });

  // Get all blocks from all properties
  const allBlocks = useMemo(() => {
    if (!property || property.length === 0) return [];
    return property.flatMap((prop) => prop.blocks || []);
  }, [property]);

  const innerBlocks = useMemo(() => {
    return getInnerBlocksForBlock(formik.values.block);
  }, [formik.values.block, property]);

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
                  <Combobox
                    multiple={true}
                    name="unitNumber"
                    value={formik.values.unitNumber}
                    onValueChange={(value) =>
                      formik.setFieldValue("unitNumber", value)

                    }
                  >
                    <ComboboxTrigger>
                      <ComboboxValue placeholder="Select Unit">
                        {formik.values.unitNumber && Array.isArray(formik.values.unitNumber) && units
                          ? formik.values.unitNumber
                            .map((id) => {
                              const unit = units.find((u) => u._id === id);
                              return unit ? unit.name : id;
                            })
                            .join(", ")
                          : formik.values.unitNumber}
                      </ComboboxValue>
                    </ComboboxTrigger>
                    <ComboboxContent>
                      <ComboboxList>
                        {units && units.map((unit) => (
                          <ComboboxItem key={unit._id} value={unit._id}>
                            {unit.name}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
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
                      {allBlocks && allBlocks.length > 0 ? (
                        allBlocks.map((block) => (
                          <SelectItem key={block._id} value={block._id}>
                            {block.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-blocks" disabled>
                          No blocks available
                        </SelectItem>
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
                      {innerBlocks && innerBlocks.length > 0 ? (
                        innerBlocks.map((ib) => (
                          <SelectItem key={ib._id} value={ib._id}>
                            {ib.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-inner-blocks" disabled>
                          No inner blocks available
                        </SelectItem>
                      )}
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
                      <SelectItem value="photo">Photo</SelectItem>
                      <SelectItem value="companyDocument">Company document</SelectItem>
                      <SelectItem value="tds">TDS</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>Upload Document</Label>
                  <div className="flex flex-col gap-2 border-2 border-gray-300 border-dashed rounded-md p-2 ">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (!formik.values.documentType) {
                          toast.error("Please select a document type first");
                          e.target.value = "";
                          return;
                        }
                        const files = Array.from(e.target.files || []);
                        const currentFiles =
                          formik.values.documents?.[
                          formik.values.documentType
                          ] || [];
                        formik.setFieldValue("documents", {
                          ...formik.values.documents,
                          [formik.values.documentType]: [
                            ...currentFiles,
                            ...files,
                          ],
                        });
                      }}
                    />
                  </div>
                  {/* Show uploaded files */}
                  {formik.values.documents &&
                    Object.entries(formik.values.documents).map(
                      ([type, files]) => (
                        <div key={type} className="space-y-2">
                          <Badge>{type}</Badge>
                          <ul className="space-y-2">
                            {files.map((file, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md"
                              >
                                <span className="flex-1 text-sm truncate">
                                  {file.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    const updatedFiles = files.filter(
                                      (_, index) => index !== i
                                    );
                                    if (updatedFiles.length === 0) {
                                      // Remove the document type if no files remain
                                      const updatedDocuments = {
                                        ...formik.values.documents,
                                      };
                                      delete updatedDocuments[type];
                                      formik.setFieldValue(
                                        "documents",
                                        updatedDocuments
                                      );
                                    } else {
                                      // Update files for this document type
                                      formik.setFieldValue("documents", {
                                        ...formik.values.documents,
                                        [type]: updatedFiles,
                                      });
                                    }
                                  }}
                                >
                                  <XIcon className="h-4 w-4" />
                                </Button>
                              </li>
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
                  <Label>Frequency Type</Label>
                  <Select
                    name="rentPaymentFrequency"
                    value={formik.values.rentPaymentFrequency}
                    onValueChange={(value) => {
                      formik.setFieldValue("rentPaymentFrequency", value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Frequency Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label>CAM Rate Per Sqft (₹)</Label>
                  <Input
                    type="number"
                    name="camRatePerSqft"
                    value={formik.values.camRatePerSqft}
                    onChange={formik.handleChange}
                  />
                  <Label>Payment Method</Label>
                  <Select
                    name="paymentMethod"
                    value={formik.values.paymentMethod}
                    onValueChange={(value) => {
                      formik.setFieldValue("paymentMethod", value);
                      // Clear payment method specific fields when changing method
                      formik.setFieldValue("bankGuaranteePhoto", null);
                      formik.setFieldValue("chequeAmount", "");
                      formik.setFieldValue("chequeNumber", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Payment Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="bank_guarantee">Bank guarantee</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Conditional fields based on payment method */}
                  {formik.values.paymentMethod === "bank_guarantee" && (
                    <>
                      <Label>Bank Guarantee Photo</Label>
                      <div className="flex flex-col gap-2 border-2 border-gray-300 border-dashed rounded-md p-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              formik.setFieldValue("bankGuaranteePhoto", file);
                            }
                          }}
                        />
                      </div>
                      {formik.values.bankGuaranteePhoto && (
                        <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md">
                          <span className="flex-1 text-sm truncate">
                            {formik.values.bankGuaranteePhoto.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              formik.setFieldValue("bankGuaranteePhoto", null);
                            }}
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {formik.values.paymentMethod === "cheque" && (
                    <>
                      <Label>Cheque Amount (₹)</Label>
                      <Input
                        type="number"
                        name="chequeAmount"
                        value={formik.values.chequeAmount}
                        onChange={formik.handleChange}
                        placeholder="Enter cheque amount"
                      />
                      <Label>Cheque Number</Label>
                      <Input
                        type="text"
                        name="chequeNumber"
                        value={formik.values.chequeNumber}
                        onChange={formik.handleChange}
                        placeholder="Enter cheque number"
                      />
                    </>
                  )}

                  {formik.values.paymentMethod !== "bank_guarantee" && (
                    <>
                      <Label>Security Deposit (₹)</Label>
                      <Input
                        type="number"
                        name="securityDeposit"
                        value={formik.values.securityDeposit}
                        onChange={formik.handleChange}
                      />
                    </>
                  )}
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