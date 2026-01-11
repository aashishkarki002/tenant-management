// components/ViewDetail.jsx
import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toNepaliDate } from "../../utils/formatNepali";

function ViewDetail({ open, onOpenChange, tenant }) {
  // Extract image and PDF URLs from documents array
  const getImageUrl = () => {
    if (!tenant?.documents || !Array.isArray(tenant.documents)) {
      return tenant?.image || null;
    }
    const imageDoc = tenant.documents.find((doc) => doc.type === "image");
    if (imageDoc && imageDoc.files && imageDoc.files.length > 0) {
      return imageDoc.files[0].url;
    }
    return tenant?.image || null; // ✅ Return image URL or null
  };

  const getPdfUrl = () => {
    if (!tenant?.documents || !Array.isArray(tenant.documents)) {
      return tenant?.pdfAgreement || null;
    }
    const pdfDoc = tenant.documents.find((doc) => doc.type === "pdfAgreement");
    if (pdfDoc && pdfDoc.files && pdfDoc.files.length > 0) {
      return pdfDoc.files[0].url;
    }
    return tenant?.pdfAgreement || null;
  };

  const imageUrl = getImageUrl();
  const pdfUrl = getPdfUrl();

  // Debug logging
  useEffect(() => {
    if (open && tenant) {
      console.log("Tenant data:", tenant);
      console.log("Tenant documents:", tenant.documents);
      console.log("Image URL:", imageUrl);
      console.log("PDF URL:", pdfUrl);
    }
  }, [open, tenant, imageUrl, pdfUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Tenant Details</DialogTitle>
          <DialogDescription>
            View and manage documents for {tenant.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Tenant Info Summary */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Name:</span>
              <span className="font-semibold text-slate-900">
                {tenant.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Unit:</span>
              <span className="font-semibold text-slate-900">
                {tenant.unitNumber
                  ? tenant.unitNumber
                  : tenant.units?.map((unit) => unit.name).join(", ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Email:</span>
              <span className="font-semibold text-slate-900">
                {tenant.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lease Start Date:</span>
              <span className="font-semibold text-slate-900">
                {toNepaliDate(tenant?.leaseStartDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lease End Date:</span>
              <span className="font-semibold text-slate-900">
                {toNepaliDate(tenant?.leaseEndDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Agreement Signed Date:</span>
              <span className="font-semibold text-slate-900">
                {toNepaliDate(tenant?.dateOfAgreementSigned)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Key Handover Date:</span>
              <span className="font-semibold text-slate-900">
                {toNepaliDate(tenant?.keyHandoverDate)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Leased Square Feet:</span>
              <span className="font-semibold text-slate-900">
                {tenant.leasedSquareFeet}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Security Deposit:</span>
              <span className="font-semibold text-slate-900">
                {tenant.securityDeposit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status:</span>
              <span className="font-semibold text-slate-900">
                {tenant.status}
              </span>
            </div>
          </div>

          {imageUrl && (
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Tenant Photo/Image:</span>
              <img
                src={imageUrl}
                alt="Tenant Photo"
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => {
                  console.error("Error loading image:", imageUrl);
                  e.target.style.display = "none";
                }}
              />
            </div>
          )}

          {pdfUrl && (
            <div className="mt-4">
              <div className="mb-2 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">
                  PDF Agreement:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(pdfUrl, "_blank")}
                  className="text-xs"
                >
                  Open in New Tab
                </Button>
              </div>
              <div
                className="w-full border border-slate-200 rounded overflow-hidden"
                style={{ height: "600px" }}
              >
                <object
                  data={pdfUrl}
                  type="application/pdf"
                  className="w-full h-full"
                  aria-label="PDF Agreement"
                >
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50">
                    <p className="text-slate-600 mb-4 text-center">
                      Unable to display PDF in browser. Please use the button
                      above to open in a new tab.
                    </p>
                    <Button
                      variant="default"
                      onClick={() => window.open(pdfUrl, "_blank")}
                    >
                      Open PDF
                    </Button>
                  </div>
                </object>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ViewDetail;
