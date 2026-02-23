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

// ─── Notification Bell ──────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications] = useState([
    { id: 1, text: "Lease expiring soon: Sarah Chen (May 30)", time: "2h ago", read: false },
    { id: 2, text: "New tenant added: Marcus Bell", time: "5h ago", read: false },
    { id: 3, text: "Rent payment received: Johnathan Doe", time: "1d ago", read: true },
  ]);
  const unread = notifications.filter((n) => !n.read).length;
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Bell className="w-4 h-4 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unread > 0 && (
              <span className="text-xs text-orange-700 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                {unread} new
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 flex gap-3 ${!n.read ? "bg-orange-50/40" : ""}`}>
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? "bg-orange-500" : "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{n.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button className="text-xs text-orange-700 font-medium hover:underline">Mark all as read</button>
          </div>
        </div>
      )}
    </div>
  );
}

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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedInnerBlock, setSelectedInnerBlock] = useState(null);
  const [search, setSearch] = useState("");
  const isInitialMount = useRef(true);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fetchProperties = async () => {
    try {
      const response = await api.get("/api/property/get-property");
      setProperties(response.data.property || []);
    } catch (error) {
      if (error.response?.status !== 401) toast.error("Failed to load properties.");
      setProperties([]);
    }
  };

  const filterTenants = async (override = {}) => {
    setLoading(true);
    try {
      const params = {};
      const searchVal = override.search !== undefined ? override.search : search;
      if (searchVal?.trim()) params.search = searchVal.trim();
      if (selectedBlock?._id) params.block = selectedBlock._id;
      if (selectedInnerBlock?._id) params.innerBlock = selectedInnerBlock._id;
      const response = await api.get(`/api/tenant/search-tenants`, { params });
      setTenants(response.data.tenants || []);
    } catch (error) {
      if (error.response?.status === 401) toast.error("Session expired. Please login again.");
      else toast.error("Failed to filter tenants.");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tenantsRes] = await Promise.all([
        api.get("/api/tenant/get-tenants"),
        fetchProperties(),
      ]);
      setTenants(tenantsRes.data.tenants || []);
    } catch (error) {
      if (error.response?.status === 401) toast.error("Session expired. Please login again.");
      else toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get("search");
    let searchFromUrl = "";
    if (q) {
      try { searchFromUrl = decodeURIComponent(q).trim(); } catch { searchFromUrl = q.trim(); }
    }
    if (searchFromUrl) {
      setSearch(searchFromUrl);
      Promise.all([fetchProperties(), filterTenants({ search: searchFromUrl })]);
    } else {
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const hasSearch = search?.trim();
    if (hasSearch || selectedBlock || selectedInnerBlock) {
      filterTenants();
    } else {
      fetchData();
    }
  }, [search, selectedBlock, selectedInnerBlock]);

  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const expiringTenants = tenants.filter((t) => {
    if (!t.leaseEndDate) return false;
    const end = new Date(t.leaseEndDate);
    const diff = (end - new Date()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 60;
  }).length;

  return (
    <div className="min-h-screen  p-6 font-sans">
      {/* Notification bell — fixed top-right, floats over content */}
      <div className="fixed top-3 right-4 z-50">
        <NotificationBell />
      </div>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tenants</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your residents and their details</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Tenants"
          value={tenants.length.toLocaleString()}
          iconBg="bg-gray-100"
          iconColor="text-gray-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Active Tenants"
          value={activeTenants.toLocaleString()}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Lease Expiring Soon"
          value={expiringTenants.toLocaleString()}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, unit, block"
            className="pl-9 h-9 text-sm bg-white border-gray-200 rounded-xl shadow-sm focus:ring-orange-500 focus:border-orange-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Block Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 text-sm bg-white border-gray-200 rounded-xl shadow-sm gap-1.5 text-gray-700"
            >
              {selectedBlock
                ? selectedInnerBlock
                  ? `${selectedBlock.name} - ${selectedInnerBlock.name}`
                  : selectedBlock.name
                : "Select Block"}
              <ArrowDown className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>
              {selectedBlock ? (selectedInnerBlock ? `${selectedBlock.name} - ${selectedInnerBlock.name}` : selectedBlock.name) : "Select Block"}
            </DropdownMenuLabel>
            {(selectedBlock || selectedInnerBlock) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSelectedBlock(null); setSelectedInnerBlock(null); }}>
                  Clear Filter
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              {properties?.length > 0 ? (
                properties.flatMap((property) =>
                  property.blocks?.length > 0
                    ? property.blocks.map((block) => (
                      <DropdownMenuSub key={block._id}>
                        <DropdownMenuSubTrigger>{block.name || `Block ${block._id}`}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          <DropdownMenuItem onClick={() => { setSelectedBlock(block); setSelectedInnerBlock(null); }}>
                            All units in {block.name}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {block.innerBlocks?.length > 0 ? (
                            block.innerBlocks.map((ib) => (
                              <DropdownMenuItem key={ib._id} onClick={() => { setSelectedBlock(block); setSelectedInnerBlock(ib); }}>
                                {ib.name || `Inner Block ${ib._id}`}
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <DropdownMenuItem disabled>No inner blocks</DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))
                    : []
                )
              ) : (
                <DropdownMenuItem disabled>No blocks available</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Send Message */}
        <Button
          variant="outline"
          className="h-9 text-sm rounded-xl border-gray-200 bg-white shadow-sm gap-1.5 text-gray-700"
          onClick={() => navigate("/tenant/send-message")}
        >
          <Send className="w-4 h-4" />
          Send Message
        </Button>

        {/* Add Tenant */}
        <Button
          className="h-9 text-sm rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-sm gap-1.5"
          onClick={() => navigate("/tenant/addTenants")}
        >
          <Plus className="w-4 h-4" />
          Add New Tenant
        </Button>
      </div>

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-16">
            <Spinner className="size-8 text-orange-700" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No tenants found</p>
          </div>
        ) : (
          tenants.map((tenant) => (
            <TenantCard
              key={tenant._id}
              tenant={tenant}
              HandleDeleteTenant={fetchData}
            />
          ))
        )}
      </div>
    </div>
  );
}