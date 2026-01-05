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
import axios from "axios";
import api from "../plugins/axios";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";

function AddTenants() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);

  useEffect(() => {
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
      console.log(response.data.units);
    };
    getUnits();
  }, []);
  useEffect(() => {
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
    onSubmit: async (values) => {
      try {
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

        // Add all form fields except files
        // FormData sends everything as strings, backend will parse them
        Object.entries(values).forEach(([key, value]) => {
          if (
            key !== "image" &&
            key !== "pdfAgreement" &&
            key !== "spaceHandoverDate" && // Handle separately
            key !== "spaceReturnedDate" // Handle separately
          ) {
            if (value !== null && value !== "" && value !== undefined) {
              formData.append(key, value);
            }
          }
        });

        // Handle optional date fields - only append if they have values
        // Backend expects null for empty optional dates
        if (values.spaceHandoverDate && values.spaceHandoverDate !== "") {
          formData.append("spaceHandoverDate", values.spaceHandoverDate);
        }
        if (values.spaceReturnedDate && values.spaceReturnedDate !== "") {
          formData.append("spaceReturnedDate", values.spaceReturnedDate);
        }

        // Handle documents - extract first image and first PDF for backward compatibility
        let hasImage = false;
        let hasPdf = false;

        Object.entries(values.documents || {}).forEach(([docType, files]) => {
          files.forEach((file) => {
            if (
              file.type === "application/pdf" ||
              file.name.toLowerCase().endsWith(".pdf")
            ) {
              if (!hasPdf) {
                formData.append("pdfAgreement", file);
                hasPdf = true;
              }
            } else if (file.type.startsWith("image/")) {
              if (!hasImage) {
                formData.append("image", file);
                hasImage = true;
              }
            }
          });
        });

        if (!hasImage || !hasPdf) {
          toast.error("At least one image and one PDF document are required");
          return;
        }

        formData.append("property", propertyId);

        const res = await api.post(
          "http://localhost:3000/api/tenant/create-tenant",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (res.data.success) {
          toast.success("Tenant created successfully!");
          formik.resetForm();
          handleClose();
        }
      } catch (error) {
        console.error("Error creating tenant:", error);
        console.error("Error response:", error?.response?.data);
        console.error("Error response errors:", error?.response?.data?.errors);

        // Handle validation errors
        if (error?.response?.data?.errors) {
          const validationErrors = error.response.data.errors;

          // Yup errors can be an array or object
          let errorMessages = [];

          if (Array.isArray(validationErrors)) {
            errorMessages = validationErrors;
          } else if (typeof validationErrors === "object") {
            // Extract error messages from yup error object
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
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

        <form
          onSubmit={formik.handleSubmit}
          className="grid lg:grid-cols-3 gap-6"
        >
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information Card */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Personal Information
                </h2>
                <FieldGroup className="space-y-5">
                  <Field>
                    <FieldLabel htmlFor="name" className="text-sm font-medium">
                      Full Name
                    </FieldLabel>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.name}
                      name="name"
                      className="mt-1.5"
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel
                        htmlFor="unitNumber"
                        className="text-sm font-medium"
                      >
                        Unit Number
                      </FieldLabel>
                      <Select
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
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="phone"
                        className="text-sm font-medium"
                      >
                        Contact Number
                      </FieldLabel>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+977-9800000000"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.phone}
                        name="phone"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel
                        htmlFor="email"
                        className="text-sm font-medium"
                      >
                        Email Address
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john.doe@example.com"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.email}
                        name="email"
                        className="mt-1.5"
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="address"
                        className="text-sm font-medium"
                      >
                        Address
                      </FieldLabel>
                      <Input
                        id="address"
                        type="text"
                        placeholder="Enter Address"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.address}
                        name="address"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            {/* Lease Information Card */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Lease Information
                </h2>
                <div className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel
                        htmlFor="leaseStartDate"
                        className="text-sm font-medium"
                      >
                        Lease Start Date AD
                      </FieldLabel>

                      <Input
                        id="leaseStartDate"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.leaseStartDate}
                        name="leaseStartDate"
                        className="mt-1.5"
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="leaseEndDate"
                        className="text-sm font-medium"
                      >
                        Lease End Date
                      </FieldLabel>
                      <Input
                        id="leaseEndDate"
                        type="date"
                        required
                        min={formik.values.leaseStartDate || undefined}
                        onChange={formik.handleChange}
                        value={formik.values.leaseEndDate}
                        name="leaseEndDate"
                        className="mt-1.5"
                      />
                      {formik.values.leaseStartDate &&
                        formik.values.leaseEndDate &&
                        new Date(formik.values.leaseEndDate) <
                          new Date(formik.values.leaseStartDate) && (
                          <p className="text-sm text-red-500 mt-1">
                            Lease end date must be after lease start date
                          </p>
                        )}
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="keyHandoverDate"
                        className="text-sm font-medium"
                      >
                        Key Handover Date
                      </FieldLabel>
                      <Input
                        id="keyHandoverDate"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.keyHandoverDate}
                        name="keyHandoverDate"
                        className="mt-1.5"
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="spaceHandoverDate"
                        className="text-sm font-medium"
                      >
                        Space Handover Date
                      </FieldLabel>
                      <Input
                        id="spaceHandoverDate"
                        type="date"
                        onChange={formik.handleChange}
                        value={formik.values.spaceHandoverDate}
                        name="spaceHandoverDate"
                        className="mt-1.5"
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="spaceReturnedDate"
                        className="text-sm font-medium"
                      >
                        Space Returned Date (Optional)
                      </FieldLabel>
                      <Input
                        id="spaceReturnedDate"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.spaceReturnedDate}
                        name="spaceReturnedDate"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Property Details Card */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Property Details
                </h2>
                <div className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="block" className="text-sm font-medium">
                        Building
                      </Label>
                      <Select
                        name="block"
                        value={formik.values.block}
                        onValueChange={(value) => {
                          formik.setFieldValue("block", value);
                          // Clear innerBlock when block changes
                          formik.setFieldValue("innerBlock", "");
                        }}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select block" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties && properties.length > 0 ? (
                            properties.flatMap((property) =>
                              property.blocks && property.blocks.length > 0
                                ? property.blocks.map((block) => (
                                    <SelectItem
                                      key={block._id}
                                      value={block._id}
                                    >
                                      {block.name || `Block ${block._id}`}
                                    </SelectItem>
                                  ))
                                : []
                            )
                          ) : (
                            <SelectItem value="no-blocks" disabled>
                              No blocks available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="innerBlock"
                        className="text-sm font-medium"
                      >
                        Block
                      </Label>
                      <Select
                        key={formik.values.block || "no-block"}
                        name="innerBlock"
                        value={formik.values.innerBlock}
                        onValueChange={(value) =>
                          formik.setFieldValue("innerBlock", value)
                        }
                        disabled={!formik.values.block}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select inner block" />
                        </SelectTrigger>
                        <SelectContent>
                          {!formik.values.block ? (
                            <SelectItem value="select-block-first" disabled>
                              Please select a block first
                            </SelectItem>
                          ) : innerBlocks.length > 0 ? (
                            innerBlocks.map((innerBlock) => (
                              <SelectItem
                                key={innerBlock._id}
                                value={innerBlock._id}
                              >
                                {innerBlock.name ||
                                  `Inner Block ${innerBlock._id}`}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-inner-blocks" disabled>
                              No inner blocks available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Card */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Documents
                </h2>
                <div className="space-y-5">
                  {/* Helper Text */}
                  <p className="text-sm text-muted-foreground mb-4">
                    Select document type first, then upload one or more files.
                  </p>

                  <div className="space-y-4">
                    {/* Document Type Selector */}
                    <div>
                      <Label
                        htmlFor="documentType"
                        className="text-sm font-medium mb-2 block"
                      >
                        Document Type
                      </Label>
                      <Select
                        name="documentType"
                        value={formik.values.documentType || ""}
                        onValueChange={(value) =>
                          formik.setFieldValue("documentType", value)
                        }
                      >
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Choose Document Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tenantPhoto">
                            Citizenship
                          </SelectItem>
                          <SelectItem value="leaseAgreement">
                            Agreement
                          </SelectItem>
                          <SelectItem value="other">Photo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Upload Document */}
                    <div>
                      <Label
                        htmlFor="fileUpload"
                        className="text-sm font-medium mb-2 block"
                      >
                        Upload Document
                      </Label>
                      <label
                        htmlFor="fileUpload"
                        className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all w-full min-h-12 px-4 py-3 ${
                          !formik.values.documentType
                            ? "border-muted bg-muted/20 cursor-not-allowed opacity-60"
                            : "border-border bg-muted/30 hover:border-primary hover:bg-muted/50"
                        }`}
                      >
                        <input
                          id="fileUpload"
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          className="hidden"
                          disabled={!formik.values.documentType}
                          multiple
                          onChange={(e) => {
                            if (!formik.values.documentType) {
                              toast.error(
                                "Please select a document type first"
                              );
                              return;
                            }
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              const currentFiles =
                                formik.values.documents?.[
                                  formik.values.documentType
                                ] || [];
                              const updatedFiles = [...currentFiles, ...files];
                              formik.setFieldValue("documents", {
                                ...formik.values.documents,
                                [formik.values.documentType]: updatedFiles,
                              });
                            }
                            e.target.value = "";
                          }}
                        />
                        <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground text-center">
                          {!formik.values.documentType
                            ? "Select document type first"
                            : "Click to upload or drag and drop"}
                        </span>
                      </label>
                    </div>

                    {/* File Preview List - Grouped by Document Type */}
                    {formik.values.documents &&
                      Object.keys(formik.values.documents).length > 0 && (
                        <div className="space-y-4 mt-6">
                          <h3 className="text-sm font-semibold text-foreground">
                            Selected Files
                          </h3>
                          {Object.entries(formik.values.documents).map(
                            ([docType, files]) => {
                              if (!files || files.length === 0) return null;
                              const docTypeLabels = {
                                tenantPhoto: "Citizenship",
                                leaseAgreement: "Agreement",
                                other: "Photo",
                              };
                              return (
                                <div
                                  key={docType}
                                  className="space-y-2 border rounded-lg p-4 bg-muted/20"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {docTypeLabels[docType] || docType}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {files.length} file
                                      {files.length !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {files.map((file, index) => (
                                      <div
                                        key={`${docType}-${index}`}
                                        className="flex items-center justify-between gap-3 p-2 bg-background rounded-md border border-border hover:bg-muted/50 transition-colors"
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          {file.type.startsWith("image/") ? (
                                            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                                          ) : (
                                            <FileIcon className="h-4 w-4 text-primary shrink-0" />
                                          )}
                                          <span className="text-sm text-foreground truncate">
                                            {file.name}
                                          </span>
                                          <span className="text-xs text-muted-foreground shrink-0">
                                            ({(file.size / 1024).toFixed(1)} KB)
                                          </span>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                          onClick={() => {
                                            const updatedFiles = files.filter(
                                              (_, i) => i !== index
                                            );
                                            if (updatedFiles.length === 0) {
                                              const newDocuments = {
                                                ...formik.values.documents,
                                              };
                                              delete newDocuments[docType];
                                              formik.setFieldValue(
                                                "documents",
                                                newDocuments
                                              );
                                            } else {
                                              formik.setFieldValue(
                                                "documents",
                                                {
                                                  ...formik.values.documents,
                                                  [docType]: updatedFiles,
                                                }
                                              );
                                            }
                                          }}
                                          aria-label={`Remove ${file.name}`}
                                        >
                                          <Trash2Icon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}

                    {/* Agreement Signed Date */}
                    <Field>
                      <FieldLabel
                        htmlFor="dateOfAgreementSigned"
                        className="text-sm font-medium"
                      >
                        Agreement Signed Date
                      </FieldLabel>
                      <Input
                        id="dateOfAgreementSigned"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.dateOfAgreementSigned}
                        name="dateOfAgreementSigned"
                        className="mt-1.5 w-full h-10"
                      />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 w-105">
            <Card className="shadow-lg sticky top-6 border-primary/20">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Rent & Financials
                </h2>
                <div className="space-y-5">
                  <div>
                    <Label
                      htmlFor="leasedSquareFeet"
                      className="text-sm font-medium"
                    >
                      Leased Square Feet (sqft)
                    </Label>
                    <Input
                      id="leasedSquareFeet"
                      type="number"
                      placeholder="100"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.leasedSquareFeet}
                      name="leasedSquareFeet"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="pricePerSqft"
                      className="text-sm font-medium"
                    >
                      Price Per Square Feet (₹)
                    </Label>
                  </div>
                  <Input
                    id="pricePerSqft"
                    type="number"
                    placeholder="100"
                    required
                    onChange={formik.handleChange}
                    value={formik.values.pricePerSqft}
                    name="pricePerSqft"
                    className="mt-1.5"
                  />

                  <div>
                    <Label
                      htmlFor="camRatePerSqft"
                      className="text-sm font-medium"
                    >
                      CAM Rate Per Square Feet (₹)
                    </Label>
                    <Input
                      id="camRatePerSqft"
                      type="number"
                      placeholder="100"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.camRatePerSqft}
                      name="camRatePerSqft"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="securityDeposit"
                      className="text-sm font-medium"
                    >
                      Security Deposit (₹)
                    </Label>
                    <Input
                      id="securityDeposit"
                      type="number"
                      placeholder="₹ 0"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.securityDeposit}
                      name="securityDeposit"
                      className="mt-1.5"
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3 bg-muted/40 rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Rent:</span>
                      <span className="font-medium">₹ 80,000</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (10%):</span>
                      <span className="font-medium">₹ 8,000</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold text-foreground">
                        Total Monthly Rent:
                      </span>
                      <span className="font-bold text-lg text-primary">
                        ₹ 88,000
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="status" className="text-sm font-medium">
                      Status
                    </Label>
                    <Select
                      name="status"
                      value={formik.values.status}
                      onValueChange={(value) =>
                        formik.setFieldValue("status", value)
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="vacated">Vacated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                      size="lg"
                    >
                      Save & Register
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-transparent"
                      size="lg"
                      onClick={handleClose}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
export default AddTenants;
