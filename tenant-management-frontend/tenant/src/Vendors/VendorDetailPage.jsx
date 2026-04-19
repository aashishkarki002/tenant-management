import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Plus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import VendorCard from "./components/VendorCard";
import VendorTransactionsTable from "./components/VendorTransactionsTable";
import ElectricityUsageCard from "./components/ElectricityUsageCard";
import VendorForm from "./components/VendorForm";
import TransactionForm from "./components/TransactionForm";
import ContractForm from "./components/ContractForm";
import ContractsList from "./components/ContractsList";
import RecordVendorPaymentDialog from "./components/RecordVendorPaymentDialog";
import { toast } from "sonner";
import {
  getVendorById,
  updateVendor,
  deleteVendor,
  getContractsByVendor,
  createContract,
  transformVendorForFrontend,
  transformVendorForBackend,
  getVendorPayments,
  getVendorBalance,
} from "./services/vendorService";

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [electricityData, setElectricityData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [submeters, setSubmeters] = useState([]);
  const [payments, setPayments] = useState([]);
  const [balance, setBalance] = useState(null);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);

  useEffect(() => {
    fetchVendorDetails();
    fetchTransactions();
    fetchSubmeters();
    fetchProperties();
    fetchPayments();
    fetchBalance();
  }, [id]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await getVendorPayments(id);
      if (res.success) setPayments(res.payments || []);
    } catch (err) {
      console.error("Error fetching payments:", err);
    }
  }, [id]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await getVendorBalance(id);
      if (res.success) setBalance(res.balance);
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  }, [id]);

  const fetchVendorDetails = async () => {
    try {
      setLoading(true);
      const response = await getVendorById(id);

      if (response.success) {
        const transformedVendor = transformVendorForFrontend(response.vendor);
        setVendor(transformedVendor);

        // Set contracts if available
        if (response.contracts) {
          setContracts(response.contracts);
        }
      } else {
        toast.error("Failed to fetch vendor details");
      }
    } catch (error) {
      console.error("Error fetching vendor details:", error);
      toast.error(error.response?.data?.message || "Failed to fetch vendor details");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {


      setTransactions(mockTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
    }
  };

  const fetchElectricityData = async (submeterId) => {
    try {


      setElectricityData(electricityData);
    } catch (error) {
      console.error("Error fetching electricity data:", error);
    }
  };

  const fetchSubmeters = async () => {
    try {
      // TODO: Replace with actual API call
      const mockSubmeters = [
        { _id: "SM-001", name: "Submeter 1", location: "Courtyard A" },
        { _id: "SM-002", name: "Submeter 2", location: "Courtyard B" },
      ];
      setSubmeters(mockSubmeters);
    } catch (error) {
      console.error("Error fetching submeters:", error);
    }
  };

  const fetchProperties = async () => {
    try {
      // TODO: Implement actual API call to fetch properties
      // For now using mock data
      const mockProperties = [
        { _id: "1", name: "Property A" },
        { _id: "2", name: "Property B" },
      ];
      setProperties(mockProperties);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const handleEditVendor = () => {
    setIsFormOpen(true);
  };

  const handleDeleteVendor = async () => {
    if (!confirm(`Are you sure you want to delete ${vendor?.name}?`)) {
      return;
    }

    try {
      const response = await deleteVendor(id);

      if (response.success) {
        toast.success("Vendor deleted successfully");
        navigate("/vendors");
      } else {
        toast.error("Failed to delete vendor");
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error(error.response?.data?.message || "Failed to delete vendor");
    }
  };

  const handleSubmitForm = async (formData) => {
    try {
      const backendData = transformVendorForBackend(formData);
      const response = await updateVendor(id, backendData);

      if (response.success) {
        const updatedVendor = transformVendorForFrontend(response.vendor);
        setVendor(updatedVendor);
        setIsFormOpen(false);
        toast.success("Vendor updated successfully");
      } else {
        toast.error("Failed to update vendor");
      }
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast.error(error.response?.data?.message || "Failed to update vendor");
    }
  };

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true);
  };

  const handleSubmitTransaction = async (transactionData) => {
    try {
      // TODO: Replace with actual API call
      // await api.post(`/api/vendor/${id}/transactions`, transactionData);

      toast.success("Transaction added successfully");
      setIsTransactionFormOpen(false);
      fetchTransactions(); // Refresh transaction list
      fetchVendorDetails(); // Refresh vendor details (balance may have changed)
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Failed to add transaction");
    }
  };

  const handleAddContract = () => {
    setSelectedContract(null);
    setIsContractFormOpen(true);
  };

  const handleEditContract = (contract) => {
    setSelectedContract(contract);
    setIsContractFormOpen(true);
  };

  const handleSubmitContract = async (contractData) => {
    try {
      const response = await createContract({
        ...contractData,
        vendorId: id,
      });

      if (response.success) {
        toast.success("Contract created successfully");
        setIsContractFormOpen(false);
        setSelectedContract(null);
        fetchVendorDetails(); // Refresh to get updated contracts
      } else {
        toast.error("Failed to create contract");
      }
    } catch (error) {
      console.error("Error creating contract:", error);
      toast.error(error.response?.data?.message || "Failed to create contract");
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-text-sub)" }}>Loading vendor details...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <div className="text-center">
          <p
            className="text-lg font-medium"
            style={{ color: "var(--color-text-strong)" }}
          >
            Vendor not found
          </p>
          <Button className="mt-4" onClick={() => navigate("/vendors")}>
            Back to Vendors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/vendors")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEditVendor}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={handleDeleteVendor}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <VendorCard vendor={vendor} />

        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--color-text-strong)" }}
              >
                Contracts
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-sub)" }}
              >
                Service contracts for this vendor
              </p>
            </div>
            <Button size="sm" onClick={handleAddContract}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contract
            </Button>
          </div>

          <ContractsList
            contracts={contracts}
            vendorId={id}
            onEdit={handleEditContract}
          />
        </div>

        {vendor.vendor_type === "stall" && (
          <ElectricityUsageCard electricityData={electricityData} />
        )}

        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--color-text-strong)" }}
              >
                Transaction History
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-sub)" }}
              >
                All financial transactions for this vendor
              </p>
            </div>
            <Button size="sm" onClick={handleAddTransaction}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>

          <VendorTransactionsTable transactions={transactions} />
        </div>

        {/* ── Payments Section ── */}
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--color-text-strong)" }}
              >
                Payments
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-sub)" }}>
                Payments made to this vendor
              </p>
            </div>
            <Button size="sm" onClick={() => setIsPaymentFormOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>

          {/* Balance summary */}
          {balance && (
            <div className="mb-6 space-y-3">
              {/* Expense side */}
              {balance.serviceContractPaisa > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--color-text-sub)" }}>
                    Expense (Service Contracts)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Contracted", value: balance.serviceContractPaisa },
                      { label: "Paid Out", value: balance.totalOutflowPaisa },
                      { label: "Outstanding", value: balance.expenseOutstandingPaisa, danger: balance.expenseOutstandingPaisa > 0 },
                    ].map(({ label, value, danger }) => (
                      <div
                        key={label}
                        className="rounded-lg border p-4"
                        style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
                      >
                        <p className="text-xs mb-1" style={{ color: "var(--color-text-sub)" }}>{label}</p>
                        <p className="text-lg font-semibold" style={{ color: danger ? "var(--color-danger)" : "var(--color-text-strong)" }}>
                          Rs. {((value ?? 0) / 100).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Revenue side */}
              {balance.stallLeaseContractPaisa > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--color-text-sub)" }}>
                    Revenue (Stall Leases)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Lease Amount", value: balance.stallLeaseContractPaisa },
                      { label: "Received", value: balance.totalInflowPaisa },
                      { label: "Outstanding", value: balance.revenueOutstandingPaisa, danger: balance.revenueOutstandingPaisa > 0 },
                    ].map(({ label, value, danger }) => (
                      <div
                        key={label}
                        className="rounded-lg border p-4"
                        style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
                      >
                        <p className="text-xs mb-1" style={{ color: "var(--color-text-sub)" }}>{label}</p>
                        <p className="text-lg font-semibold" style={{ color: danger ? "var(--color-danger)" : "var(--color-success)" }}>
                          Rs. {((value ?? 0) / 100).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Fallback for vendors with no contracts yet */}
              {!balance.serviceContractPaisa && !balance.stallLeaseContractPaisa && (
                <p className="text-sm py-2" style={{ color: "var(--color-text-weak)" }}>No contracts yet</p>
              )}
            </div>
          )}

          {/* Payments table */}
          {payments.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--color-text-weak)" }}>
              No payments recorded yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["Date", "Direction", "Amount", "Method", "Reference", "TDS Deducted", "Recorded By"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2 px-3 text-xs font-medium"
                        style={{ color: "var(--color-text-sub)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p._id}
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      <td className="py-2.5 px-3" style={{ color: "var(--color-text-body)" }}>
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-xs rounded px-1.5 py-0.5 font-medium"
                          style={{
                            backgroundColor: p.paymentDirection === "inflow" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                            color: p.paymentDirection === "inflow" ? "var(--color-success)" : "var(--color-danger)",
                          }}
                        >
                          {p.paymentDirection === "inflow" ? "Received" : "Paid Out"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium" style={{ color: "var(--color-text-strong)" }}>
                        Rs. {((p.amountPaisa ?? 0) / 100).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 capitalize" style={{ color: "var(--color-text-body)" }}>
                        {p.paymentMethod?.replace("_", " ")}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: "var(--color-text-sub)" }}>
                        {p.referenceNumber || "—"}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: "var(--color-text-sub)" }}>
                        {p.tdsDeductedPaisa ? `Rs. ${(p.tdsDeductedPaisa / 100).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: "var(--color-text-sub)" }}>
                        {p.recordedBy?.name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <VendorForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
        vendor={vendor}
        submeters={submeters}
      />

      <ContractForm
        open={isContractFormOpen}
        onClose={() => {
          setIsContractFormOpen(false);
          setSelectedContract(null);
        }}
        onSubmit={handleSubmitContract}
        contract={selectedContract}
        vendorId={id}
        properties={properties}
      />

      <TransactionForm
        open={isTransactionFormOpen}
        onClose={() => setIsTransactionFormOpen(false)}
        onSubmit={handleSubmitTransaction}
        vendor={vendor}
      />

      <RecordVendorPaymentDialog
        open={isPaymentFormOpen}
        onClose={() => setIsPaymentFormOpen(false)}
        vendorId={id}
        contracts={contracts}
        onSuccess={() => {
          fetchPayments();
          fetchBalance();
        }}
      />
    </div>
  );
}
