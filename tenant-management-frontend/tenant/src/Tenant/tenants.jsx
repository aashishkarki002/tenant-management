import React from "react";
import { Input } from "@/components/ui/input";
import { Search, Bell, Plus, Send, ArrowDown, Users, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";
import TenantCard from "../components/TenantCard";
import api from "../../plugins/axios";
import { toast } from "sonner";
import { getAllBlocks } from "./addTenant/utils/propertyHelper";


// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedInnerBlock, setSelectedInnerBlock] = useState(null);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  /* ==============================
     DATA FETCHING
  ============================== */

  const fetchProperties = async () => {
    try {
      const res = await api.get("/api/property/get-property");
      setProperties(res.data.property || []);
    } catch {
      setProperties([]);
    }
  };

  const fetchAllTenants = async () => {
    try {
      const res = await api.get("/api/tenant/get-tenants");
      setTenants(res.data.tenants || []);
    } catch {
      toast.error("Failed to load tenants");
      setTenants([]);
    }
  };

  const filterTenants = async (override = {}) => {
    try {
      const params = {};
      const searchVal =
        override.search !== undefined ? override.search : search;

      if (searchVal?.trim()) params.search = searchVal.trim();
      if (selectedBlock?._id) params.block = selectedBlock._id;
      if (selectedInnerBlock?._id)
        params.innerBlock = selectedInnerBlock._id;

      const res = await api.get("/api/tenant/search-tenants", { params });
      setTenants(res.data.tenants || []);
    } catch {
      toast.error("Failed to filter tenants");
      setTenants([]);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchProperties(), fetchAllTenants()]);
    setLoading(false);
  };

  /* ==============================
     EFFECTS
  ============================== */

  useEffect(() => {
    const q = searchParams.get("search");
    if (q?.trim()) {
      setSearch(q.trim());
      setLoading(true);
      Promise.all([
        fetchProperties(),
        filterTenants({ search: q.trim() }),
      ]).finally(() => setLoading(false));
    } else {
      loadInitialData();
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const hasFilter =
      search?.trim() || selectedBlock || selectedInnerBlock;

    setLoading(true);

    if (hasFilter) {
      filterTenants().finally(() => setLoading(false));
    } else {
      fetchAllTenants().finally(() => setLoading(false));
    }
  }, [search, selectedBlock, selectedInnerBlock]);

  /* ==============================
     DERIVED DATA
  ============================== */

  const allBlocks = React.useMemo(
    () => getAllBlocks(properties),
    [properties]
  );

  const activeTenants = tenants.filter(
    (t) => t.status === "active"
  ).length;

  const expiringTenants = tenants.filter((t) => {
    if (!t.leaseEndDate) return false;
    const diff =
      (new Date(t.leaseEndDate) - new Date()) /
      (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 60;
  }).length;

  /* ==============================
     UI
  ============================== */
  function TenantCardSkeleton() {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
        </div>

        <div className="flex justify-between">
          <div className="h-8 w-20 bg-gray-200 rounded-lg" />
          <div className="h-8 w-16 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 font-sans">

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Tenants
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Manage your residents and their details
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Tenants"
          value={tenants.length}
          iconBg="bg-gray-100"
          iconColor="text-gray-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Active Tenants"
          value={activeTenants}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Lease Expiring Soon"
          value={expiringTenants}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">

        <div className="flex flex-col sm:flex-row gap-3 flex-1">

          {/* SEARCH */}
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm w-full"
            />
          </div>

          {/* BLOCK DROPDOWN */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-sm w-full sm:w-auto justify-between"
              >
                {selectedBlock
                  ? selectedInnerBlock
                    ? `${selectedBlock.name} - ${selectedInnerBlock.name}`
                    : selectedBlock.name
                  : "Select Block"}
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[90vw] sm:w-56 max-w-xs" align="start">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedBlock(null);
                  setSelectedInnerBlock(null);
                }}
              >
                Clear filter
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {allBlocks.length === 0 ? (
                <DropdownMenuItem disabled>No blocks available</DropdownMenuItem>
              ) : (
                allBlocks.map((block) => (
                  <DropdownMenuSub key={block._id}>
                    <DropdownMenuSubTrigger>{block.name}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedBlock(block);
                          setSelectedInnerBlock(null);
                        }}
                      >
                        All {block.name}
                      </DropdownMenuItem>
                      {Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          {block.innerBlocks.map((inner) => (
                            <DropdownMenuItem
                              key={inner._id}
                              onClick={() => {
                                setSelectedBlock(block);
                                setSelectedInnerBlock(inner);
                              }}
                            >
                              {inner.name}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="h-9 text-sm w-full sm:w-auto"
            onClick={() => navigate("/tenant/send-message")}
          >
            <Send className="w-4 h-4 mr-1" />
            Send Message
          </Button>

          <Button
            className="h-9 text-sm bg-gray-900 hover:bg-gray-800 text-white w-full sm:w-auto"
            onClick={() => navigate("/tenant/addTenants")}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Tenant
          </Button>
        </div>
      </div>

      {/* TENANT GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

        {loading ? (
          [...Array(6)].map((_, i) => (
            <TenantCardSkeleton key={i} />
          ))
        ) : tenants.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              No tenants found
            </p>
          </div>
        ) : (
          tenants.map((tenant) => (
            <TenantCard
              key={tenant._id}
              tenant={tenant}
              HandleDeleteTenant={fetchAllTenants}
            />
          ))
        )}
      </div>
    </div>
  );
}