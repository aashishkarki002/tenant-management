import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '../../Tenant/addTenant/constants/tenant.constant.js';

const VALID_PAYMENT_METHODS = Object.values(PAYMENT_METHODS);

export default function CompletionDialog({
  item,
  bankAccounts = [],
  open,
  onOpenChange,
  onComplete,
}) {
  const [overpaymentMeta, setOverpaymentMeta] = useState(null);
  const [formData, setFormData] = useState({
    paymentStatus: 'pending',
    paidAmount: '0',
    paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
    bankAccountId: '',
  });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');

  useEffect(() => {
    if (item) {
      setFormData({
        paymentStatus: item.paymentStatus || 'pending',
        paidAmount: item.paidAmount?.toString() || '0',
        paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
        bankAccountId: '',
      });
      setOverpaymentMeta(null);
    }
  }, [item]);

  useEffect(() => {
    if (open) setSelectedBankAccountId(formData.bankAccountId || '');
  }, [open, formData.bankAccountId]);

  const updateFormField = (field, value) => {
    if (field === 'paidAmount') setOverpaymentMeta(null);
    if (field === 'paymentMethod') {
      if (value !== PAYMENT_METHODS.BANK_TRANSFER && value !== PAYMENT_METHODS.CHEQUE) {
        setSelectedBankAccountId('');
        setFormData((prev) => ({ ...prev, [field]: value, bankAccountId: '' }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const currentPaymentMethod =
    formData.paymentMethod && VALID_PAYMENT_METHODS.includes(formData.paymentMethod)
      ? formData.paymentMethod
      : PAYMENT_METHODS.BANK_TRANSFER;

  const estimatedAmount = item?.amount || 0;
  const paidAmountNum = Number(formData.paidAmount) || 0;
  const isOverpayingInForm = estimatedAmount > 0 && paidAmountNum > estimatedAmount;

  const submitCompletion = async (allowOverpayment = false) => {
    if (!item) return;
    const paymentMethod =
      formData.paymentMethod && VALID_PAYMENT_METHODS.includes(formData.paymentMethod)
        ? formData.paymentMethod
        : PAYMENT_METHODS.BANK_TRANSFER;

    const payload = {
      status: 'COMPLETED',
      paymentStatus: formData.paymentStatus,
      paidAmount: Number(formData.paidAmount),
      paymentMethod,
      ...(allowOverpayment && { allowOverpayment: true }),
    };

    if (
      paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
      paymentMethod === PAYMENT_METHODS.CHEQUE
    ) {
      if (formData.bankAccountId) payload.bankAccountId = formData.bankAccountId;
    }

    try {
      await api.patch(`/api/maintenance/${item._id}/status`, payload);
      toast.success(
        allowOverpayment
          ? 'Work order completed (overpayment recorded)'
          : 'Work order completed',
      );
      setOverpaymentMeta(null);
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.isOverpayment) {
        setOverpaymentMeta({
          message: data.message,
          diffRupees: data.overpaymentDiffRupees,
        });
        return;
      }
      toast.error(data?.message || 'Failed to complete work order');
    }
  };

  const handleClose = () => {
    setOverpaymentMeta(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-black sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Complete Work Order
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Confirm payment details before marking this task as completed.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Payment Status</Label>
            <Select
              value={formData.paymentStatus}
              onValueChange={(v) => updateFormField('paymentStatus', v)}
            >
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Paid Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.paidAmount}
              disabled={formData.paymentStatus === 'pending'}
              onChange={(e) => updateFormField('paidAmount', e.target.value)}
            />
            {isOverpayingInForm && !overpaymentMeta && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Paid amount exceeds estimated (₹{estimatedAmount}). You will be
                asked to confirm.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={currentPaymentMethod}
              onValueChange={(v) => updateFormField('paymentMethod', v)}
            >
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PAYMENT_METHODS.CASH}>Cash</SelectItem>
                <SelectItem value={PAYMENT_METHODS.BANK_TRANSFER}>
                  Bank Transfer
                </SelectItem>
                <SelectItem value={PAYMENT_METHODS.CHEQUE}>Cheque</SelectItem>
                <SelectItem value={PAYMENT_METHODS.MOBILE_WALLET}>
                  Mobile Wallet
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(currentPaymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
            currentPaymentMethod === PAYMENT_METHODS.CHEQUE) && (
            <div className="space-y-2">
              <Label>Deposit To (Bank Account)</Label>
              <div className="grid gap-2">
                {Array.isArray(bankAccounts) &&
                  bankAccounts.map((bank) => (
                    <button
                      key={bank._id}
                      type="button"
                      onClick={() => {
                        setSelectedBankAccountId(bank._id);
                        updateFormField('bankAccountId', bank._id);
                      }}
                      className={`w-full text-left p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedBankAccountId === bank._id
                          ? 'border-slate-900 bg-slate-900/[0.03]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 text-sm">
                            {bank.bankName}
                          </p>
                          <p className="text-xs text-slate-500">
                            **** **** {bank.accountNumber?.slice(-4) || '****'}
                          </p>
                        </div>
                        {selectedBankAccountId === bank._id && (
                          <div className="text-slate-900 ml-2">
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {overpaymentMeta && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Overpayment detected
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {overpaymentMeta.message}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Excess:{' '}
                    <span className="font-semibold">
                      ₹{overpaymentMeta.diffRupees}
                    </span>
                    . This will be recorded as an <strong>overpaid</strong>{' '}
                    expense in accounting.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setOverpaymentMeta(null)}
                >
                  Edit Amount
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  onClick={() => submitCompletion(true)}
                >
                  Confirm Overpayment
                </Button>
              </div>
            </div>
          )}
        </div>

        {!overpaymentMeta && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => submitCompletion(false)}
            >
              Complete
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
