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
import { useParams } from "react-router-dom";

function EditTenant() {
  const { id } = useParams();
  const formik = useFormik({
    initialValues: {
      name: "",
      unitNumber: "",
      phone: "",
      email: "",
      address: "",
      leaseStart: "",
      leaseEnd: "",
      block: "",
      innerBlock: "",
      image: null,
      pdfAgreement: null,
      agreementSignedDate: "",
      propertySize: "",
      securityDeposit: "",
      status: "",
    },
    onSubmit: (values) => {
      console.log(values);
    },
  });

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
            Edit Tenant
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
                        htmlFor="leaseStart"
                        className="text-sm font-medium"
                      >
                        Lease Start Date
                      </FieldLabel>
                      <Input
                        id="leaseStart"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.leaseStart}
                        name="leaseStart"
                        className="mt-1.5"
                      />
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="leaseEnd"
                        className="text-sm font-medium"
                      >
                        Lease End Date
                      </FieldLabel>
                      <Input
                        id="leaseEnd"
                        type="date"
                        required
                        onChange={formik.handleChange}
                        value={formik.values.leaseEnd}
                        name="leaseEnd"
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
                        onValueChange={(value) =>
                          formik.setFieldValue("block", value)
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select block" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Block 1</SelectItem>
                          <SelectItem value="2">Block 2</SelectItem>
                          <SelectItem value="3">Block 3</SelectItem>
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
                        name="innerBlock"
                        value={formik.values.innerBlock}
                        onValueChange={(value) =>
                          formik.setFieldValue("innerBlock", value)
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select inner block" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Inner Block 1</SelectItem>
                          <SelectItem value="2">Inner Block 2</SelectItem>
                          <SelectItem value="3">Inner Block 3</SelectItem>
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
                        Tenant Photo (Optional)
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
                      htmlFor="agreementSignedDate"
                      className="text-sm font-medium"
                    >
                      Agreement Signed Date
                    </FieldLabel>
                    <Input
                      id="agreementSignedDate"
                      type="date"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.agreementSignedDate}
                      name="agreementSignedDate"
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
                      htmlFor="propertySize"
                      className="text-sm font-medium"
                    >
                      Property Size (sqm)
                    </Label>
                    <Input
                      id="propertySize"
                      type="number"
                      placeholder="100"
                      required
                      onChange={formik.handleChange}
                      value={formik.values.propertySize}
                      name="propertySize"
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
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="MovedOut">Moved Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      type="submit"
                      variant="default"
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                      size="lg"
                    >
                      Save Changes
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
export default EditTenant;
