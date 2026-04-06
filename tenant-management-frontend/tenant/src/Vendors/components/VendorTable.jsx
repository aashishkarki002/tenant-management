import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,

  Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VendorTable({ vendors, onEdit, onDelete, onAddTransaction }) {
  const navigate = useNavigate();

  const getVendorTypeBadge = (type) => {
    if (type === "service") {
      return (
        <Badge
          className="text-xs"
          style={{
            backgroundColor: "var(--color-info-bg)",
            color: "var(--color-info)",
            border: "1px solid var(--color-info-border)",
          }}
        >
          Service
        </Badge>
      );
    }
    return (
      <Badge
        className="text-xs"
        style={{
          backgroundColor: "var(--color-success-bg)",
          color: "var(--color-success)",
          border: "1px solid var(--color-success-border)",
        }}
      >
        Stall
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: {
        bg: "var(--color-success-bg)",
        text: "var(--color-success)",
        border: "var(--color-success-border)",
        label: "Active",
      },
      inactive: {
        bg: "var(--color-warning-bg)",
        text: "var(--color-warning)",
        border: "var(--color-warning-border)",
        label: "Inactive",
      },
    };

    const config = statusConfig[status] || statusConfig.active;

    return (
      <Badge
        className="text-xs"
        style={{
          backgroundColor: config.bg,
          color: config.text,
          border: `1px solid ${config.border}`,
        }}
      >
        {config.label}
      </Badge>
    );
  };

  const formatBalance = (balance, vendorType) => {
    if (!balance || balance === 0) {
      return (
        <span style={{ color: "var(--color-text-sub)" }}>
          रू 0
        </span>
      );
    }

    if (vendorType === "stall") {
      return (
        <span
          style={{
            color: balance > 0 ? "var(--color-success)" : "var(--color-danger)",
            fontWeight: 600,
          }}
        >
          रू {Math.abs(balance).toLocaleString()}
        </span>
      );
    } else {
      return (
        <span
          style={{
            color: balance > 0 ? "var(--color-danger)" : "var(--color-success)",
            fontWeight: 600,
          }}
        >
          रू {Math.abs(balance).toLocaleString()}
        </span>
      );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ backgroundColor: "var(--color-bg)" }}>
            <TableHead className="font-semibold">Vendor Name</TableHead>
            <TableHead className="font-semibold">Vendor Type</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Balance</TableHead>
            <TableHead className="font-semibold">Last Transaction</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors && vendors.length > 0 ? (
            vendors.map((vendor) => (
              <TableRow key={vendor._id || vendor.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span style={{ color: "var(--color-text-strong)" }}>
                      {vendor.name}
                    </span>
                    {vendor.contact && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-sub)" }}
                      >
                        {vendor.contact}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getVendorTypeBadge(vendor.vendor_type)}</TableCell>
                <TableCell>{getStatusBadge(vendor.status || "active")}</TableCell>
                <TableCell className="text-right">
                  {formatBalance(vendor.balance, vendor.vendor_type)}
                </TableCell>
                <TableCell>
                  <span style={{ color: "var(--color-text-body)" }}>
                    {formatDate(vendor.last_transaction_date)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/vendors/${vendor._id || vendor.id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(vendor)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Vendor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddTransaction(vendor)}>
                        <Receipt className="mr-2 h-4 w-4" />
                        Add Transaction
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(vendor)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Vendor
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <div
                    className="mb-2 text-3xl opacity-40"
                    style={{ color: "var(--color-text-sub)" }}
                  >

                  </div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-body)" }}
                  >
                    No vendors found
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Add a vendor to get started
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
