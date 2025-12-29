"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardListIcon, XIcon, ImageIcon, FileIcon } from "lucide-react";
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
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";


function AddTenants() {
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await axios.get(
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
      image: null,
      pdfAgreement: null,
      dateOfAgreementSigned: "",
      leasedSquareFeet: "",
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

        if (!values.image || !values.pdfAgreement) {
          toast.error("Image and PDF are required");
          return;
        }

        formData.append("image", values.image);
        formData.append("pdfAgreement", values.pdfAgreement);
        formData.append("property", propertyId);

        const res = await axios.post(
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
                      <Input
                        id="unitNumber"
                        type="text"
                        placeholder="A-101"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.unitNumber}
                        name="unitNumber"
                        className="mt-1.5"
                      />
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
                        Space Handover Date (Optional)
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
                        Space Returned Date
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
                        Block
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
                        Inner Block
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
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="image"
                        className="text-sm font-medium mb-2 block"
                      >
                        Tenant Photo *
                      </Label>
                      <label
                        htmlFor="image"
                        className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 hover:border-primary hover:bg-muted/50 transition-all"
                      >
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formik.values.image
                            ? formik.values.image.name
                            : "Upload Photo"}
                        </span>
                      </label>
                      <input
                        id="image"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          formik.setFieldValue("image", e.target.files?.[0])
                        }
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="pdfAgreement"
                        className="text-sm font-medium mb-2 block"
                      >
                        Lease Agreement (PDF)
                      </Label>
                      <label
                        htmlFor="pdfAgreement"
                        className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 hover:border-primary hover:bg-muted/50 transition-all"
                      >
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formik.values.pdfAgreement
                            ? formik.values.pdfAgreement.name
                            : "Upload PDF"}
                        </span>
                      </label>
                      <input
                        id="pdfAgreement"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) =>
                          formik.setFieldValue(
                            "pdfAgreement",
                            e.target.files?.[0]
                          )
                        }
                      />
                    </div>
                  </div>

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
                      className="mt-1.5"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
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
