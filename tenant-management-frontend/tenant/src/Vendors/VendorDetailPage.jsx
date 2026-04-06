import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import VendorCard from "./components/VendorCard";
import VendorTransactionsTable from "./components/VendorTransactionsTable";
import ElectricityUsageCard from "./components/ElectricityUsageCard";
import VendorForm from "./components/VendorForm";
import TransactionForm from "./components/TransactionForm";
import ContractForm from "./components/ContractForm";
import ContractsList from "./components/ContractsList";
import { toast } from "sonner";
import {
  getVendorById,
  updateVendor,
  deleteVendor,
  getContractsByVendor,
  createContract,
  transformVendorForFrontend,
  transformVendorForBackend,
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

  useEffect(() => {
    fetchVendorDetails();
    fetchTransactions();
    fetchSubmeters();
    fetchProperties();
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
    </div>
  );
}
