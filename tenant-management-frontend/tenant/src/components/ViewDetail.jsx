import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import api from '../../plugins/axios'

function ViewDetail({open, onOpenChange, tenant}) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const blobUrlRef = useRef(null);

  const fetchPdf = useCallback(async () => {
    if (!tenant?.pdfAgreement) return;

    setPdfLoading(true);
    setPdfError(null);

    try {
      // Check if it's a Cloudinary URL or backend URL
      const isCloudinaryUrl = tenant.pdfAgreement.includes('cloudinary.com') || 
                              tenant.pdfAgreement.includes('res.cloudinary.com');
      
      let blob;
      
      if (isCloudinaryUrl) {
        // For Cloudinary URLs, try fetching directly first
        try {
          const response = await fetch(tenant.pdfAgreement, {
            method: 'GET',
            headers: {
              'Accept': 'application/pdf',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
          }
          
          blob = await response.blob();
        } catch (fetchError) {
          // If direct fetch fails (e.g., 401, CORS), try with authenticated axios
          console.log('Direct fetch failed, trying with authentication:', fetchError);
          const response = await api.get(tenant.pdfAgreement, {
            responseType: 'blob',
            headers: {
              'Accept': 'application/pdf',
            },
          });
          blob = new Blob([response.data], { type: 'application/pdf' });
        }
      } else {
        // For backend URLs, use authenticated axios
        const response = await api.get(tenant.pdfAgreement, {
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf',
          },
        });
        blob = new Blob([response.data], { type: 'application/pdf' });
      }
      
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setPdfUrl(blobUrl);
    } catch (error) {
      console.error('Error fetching PDF:', error);
      setPdfError('Failed to load PDF. Please try again.');
      // Don't set fallback URL as it will likely fail with 401 again
    } finally {
      setPdfLoading(false);
    }
  }, [tenant?.pdfAgreement]);

  useEffect(() => {
    if (open && tenant?.pdfAgreement) {
      fetchPdf();
    } else if (!open) {
      // Clean up blob URL when dialog closes
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setPdfUrl(null);
      }
    }

    // Cleanup function - revoke blob URL when component unmounts
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [open, tenant?.pdfAgreement, fetchPdf]);

  return (

<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Tenant Details</DialogTitle>
          <DialogDescription>View and manage documents for {tenant.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Tenant Info Summary */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Name:</span>
              <span className="font-semibold text-slate-900">{tenant.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Unit:</span>
              <span className="font-semibold text-slate-900">{tenant.unitNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Email:</span>
              <span className="font-semibold text-slate-900">{tenant.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lease Start Date:</span>
              <span className="font-semibold text-slate-900">{new Date(tenant.leaseStartDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lease End Date:</span>
              <span className="font-semibold text-slate-900">{new Date(tenant.leaseEndDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Key Handover Date:</span>
              <span className="font-semibold text-slate-900">{new Date(tenant.keyHandoverDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Leased Square Feet:</span>
              <span className="font-semibold text-slate-900">{tenant.leasedSquareFeet}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Security Deposit:</span>
              <span className="font-semibold text-slate-900">{tenant.securityDeposit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status:</span>
              <span className="font-semibold text-slate-900">{tenant.status}</span>
            </div>
          </div>
          <div className="flex justify-between">
              <span className="text-slate-600">Tenant Photo/Image:</span>
              <img src={tenant.image} alt="Tenant Photo" className="w-20 h-20 rounded-full" />
            </div>
          
        {tenant.pdfAgreement && (
          <div className="mt-4">
            <div className="mb-2 text-sm text-slate-600">PDF Agreement:</div>
            {pdfLoading ? (
              <div className="w-full border border-slate-200 rounded flex items-center justify-center" style={{ height: "600px" }}>
                <div className="text-slate-600">Loading PDF...</div>
              </div>
            ) : pdfError ? (
              <div className="w-full border border-slate-200 rounded p-4" style={{ height: "600px" }}>
                <div className="text-red-600 mb-2">{pdfError}</div>
                <Button onClick={fetchPdf} variant="outline" size="sm">Retry</Button>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full border border-slate-200 rounded"
                style={{ height: "600px" }}
                title="PDF Agreement"
              />
            ) : null}
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
    )
}
export default ViewDetail;