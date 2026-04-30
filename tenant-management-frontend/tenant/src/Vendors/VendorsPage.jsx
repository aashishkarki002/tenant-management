import { useState, useEffect } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VendorStats from "./components/VendorStats";
import VendorTable from "./components/VendorTable";
import VendorForm from "./components/VendorForm";
import TransactionForm from "./components/TransactionForm";

import { toast } from "sonner";
import {
  getAllVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  transformVendorForFrontend,
  transformVendorForBackend,
} from "./services/vendorService";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    outstandingBalance: 0,
    activeStallVendors: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [selectedVendorForTransaction, setSelectedVendorForTransaction] = useState(null);
  const [submeters, setSubmeters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors();
    fetchSubmeters();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchQuery, filterType]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await getAllVendors();

      if (response.success) {
        // Transform backend vendors to frontend format
        const transformedVendors = response.vendors.map(transformVendorForFrontend);
        setVendors(transformedVendors);
        calculateStats(transformedVendors);
      } else {
        toast.error("Failed to fetch vendors");
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error(error.response?.data?.message || "Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmeters = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await api.get('/api/submeters');
      // setSubmeters(response.data);

      // Mock data
      const mockSubmeters = [
        { _id: "SM-001", name: "Submeter 1", location: "Courtyard A" },
        { _id: "SM-002", name: "Submeter 2", location: "Courtyard B" },
      ];
      setSubmeters(mockSubmeters);
    } catch (error) {
      console.error("Error fetching submeters:", error);
    }
  };

  const calculateStats = (vendorList) => {
    const newStats = vendorList.reduce(
      (acc, vendor) => {
        if (vendor.vendor_type === "stall") {
          acc.totalRevenue += Math.max(0, vendor.balance || 0);
          acc.activeStallVendors += 1;
        } else {
          acc.totalExpenses += Math.abs(Math.min(0, vendor.balance || 0));
        }
        acc.outstandingBalance += vendor.balance || 0;
        return acc;
      },
      {
        totalRevenue: 0,
        totalExpenses: 0,
        outstandingBalance: 0,
        activeStallVendors: 0,
      }
    );

    setStats(newStats);
  };

  const filterVendors = () => {
    let filtered = [...vendors];

    if (searchQuery) {
      filtered = filtered.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (vendor.contact &&
            vendor.contact.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(
        (vendor) => vendor.vendor_type === filterType
      );
    }

    setFilteredVendors(filtered);
  };

  const handleAddVendor = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
  };

  const handleEditVendor = (vendor) => {
    setSelectedVendor(vendor);
    setIsFormOpen(true);
  };

  const handleDeleteVendor = async (vendor) => {
    if ((`Are you sure you want to delete ${vendor.name}?`)) {
      return;
    }

    try {
      const response = await deleteVendor(vendor._id);

      if (response.success) {
        setVendors((prev) =>
          prev.filter((v) => v._id !== vendor._id)
        );
        toast.success("Vendor deleted successfully");
      } else {
        toast.error("Failed to delete vendor");
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error(error.response?.data?.message || "Failed to delete vendor");
    }
  };

  const handleAddTransaction = (vendor) => {
    setSelectedVendorForTransaction(vendor);
    setIsTransactionFormOpen(true);
  };

  const handleSubmitTransaction = async (transactionData) => {
    try {
      // TODO: Replace with actual API call
      await api.post(`/api/vendors/${selectedVendorForTransaction._id}/transactions`, transactionData);

      toast.success("Transaction added successfully");
      setIsTransactionFormOpen(false);
      setSelectedVendorForTransaction(null);
      fetchVendors(); // Refresh vendor list
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Failed to add transaction");
    }
  };

  const handleSubmitForm = async (formData) => {
    try {
      const backendData = transformVendorForBackend(formData);

      if (selectedVendor) {
        const response = await updateVendor(selectedVendor._id, backendData);

        if (response.success) {
          const updatedVendor = transformVendorForFrontend(response.vendor);
          setVendors((prev) =>
            prev.map((v) =>
              v._id === selectedVendor._id ? updatedVendor : v
            )
          );
          toast.success("Vendor updated successfully");
        } else {
          toast.error("Failed to update vendor");
        }
      } else {
        const response = await createVendor(backendData);

        if (response.success) {
          const newVendor = transformVendorForFrontend(response.vendor);
          setVendors((prev) => [...prev, newVendor]);
          toast.success("Vendor added successfully");
        } else {
          toast.error("Failed to add vendor");
        }
      }

      setIsFormOpen(false);
      setSelectedVendor(null);
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error(error.response?.data?.message || "Failed to save vendor");
    }
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ color: "var(--color-text-strong)" }}
            >
              Vendors
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--color-text-sub)" }}
            >
              Manage service vendors and stall vendors
            </p>
          </div>
          <Button onClick={handleAddVendor}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        <VendorStats stats={stats} />

        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-text-sub)" }}
              />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                <SelectItem value="service">Service Vendors</SelectItem>
                <SelectItem value="stall">Stall Vendors</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="all" value={filterType} onValueChange={setFilterType}>
            <TabsList>
              <TabsTrigger value="all">All Vendors</TabsTrigger>
              <TabsTrigger value="service">Service Vendors</TabsTrigger>
              <TabsTrigger value="stall">Stall Vendors</TabsTrigger>
            </TabsList>

            <TabsContent value={filterType} className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p style={{ color: "var(--color-text-sub)" }}>
                    Loading vendors...
                  </p>
                </div>
              ) : (
                <VendorTable
                  vendors={filteredVendors}
                  onEdit={handleEditVendor}
                  onDelete={handleDeleteVendor}
                  onAddTransaction={handleAddTransaction}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <VendorForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedVendor(null);
        }}
        onSubmit={handleSubmitForm}
        vendor={selectedVendor}
        submeters={submeters}
      />

      <TransactionForm
        open={isTransactionFormOpen}
        onClose={() => {
          setIsTransactionFormOpen(false);
          setSelectedVendorForTransaction(null);
        }}
        onSubmit={handleSubmitTransaction}
        vendor={selectedVendorForTransaction}
      />
    </div>
  );
}
