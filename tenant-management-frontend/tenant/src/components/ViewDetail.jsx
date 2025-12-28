import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function ViewDetail({open, onOpenChange, tenant}) {
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
            <iframe
              src={tenant.pdfAgreement}
              className="w-full border border-slate-200 rounded"
              style={{ height: "600px" }}
              title="PDF Agreement"
            />
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