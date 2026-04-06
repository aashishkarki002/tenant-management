import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, FileText } from "lucide-react";

export default function ContractsList({ contracts, onEdit, onViewDetails }) {
  const formatCurrency = (paisa) => {
    if (!paisa) return "रू 0";
    const rupees = paisa / 100;
    return `रू ${rupees.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  const getBillingCycleBadge = (cycle) => {
    const config = {
      monthly: {
        bg: "var(--color-info-bg)",
        text: "var(--color-info)",
        border: "var(--color-info-border)",
        label: "Monthly",
      },
      quarterly: {
        bg: "var(--color-warning-bg)",
        text: "var(--color-warning)",
        border: "var(--color-warning-border)",
        label: "Quarterly",
      },
      one_time: {
        bg: "var(--color-accent-bg)",
        text: "var(--color-accent)",
        border: "var(--color-accent-border)",
        label: "One Time",
      },
    };

    const c = config[cycle] || config.monthly;

    return (
      <Badge
        className="text-xs"
        style={{
          backgroundColor: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
        }}
      >
        {c.label}
      </Badge>
    );
  };

  const getStatusBadge = (contract) => {
    const now = new Date();
    const endDate = contract.endDate ? new Date(contract.endDate) : null;
    const isActive = contract.isActive !== false;

    if (!isActive) {
      return (
        <Badge
          className="text-xs"
          style={{
            backgroundColor: "var(--color-text-sub-bg)",
            color: "var(--color-text-sub)",
            border: "1px solid var(--color-border)",
          }}
        >
          Inactive
        </Badge>
      );
    }

    if (endDate && endDate < now) {
      return (
        <Badge
          className="text-xs"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            border: "1px solid var(--color-danger-border)",
          }}
        >
          Expired
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
        Active
      </Badge>
    );
  };

  if (!contracts || contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="mb-2 text-3xl opacity-40"
          style={{ color: "var(--color-text-sub)" }}
        >
          📄
        </div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--color-text-body)" }}
        >
          No contracts found
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
          Create a contract to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <div
          key={contract._id}
          className="rounded-lg border p-4"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold"
                  style={{ color: "var(--color-text-strong)" }}
                >
                  {contract.property?.name || "Property"}
                </h3>
                {getStatusBadge(contract)}
                {getBillingCycleBadge(contract.billingCycle)}
              </div>

              {contract.description && (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-body)" }}
                >
                  {contract.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Amount
                  </p>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--color-text-strong)" }}
                  >
                    {formatCurrency(contract.contractAmountPaisa)}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Start Date
                  </p>
                  <p style={{ color: "var(--color-text-body)" }}>
                    {formatDate(contract.startDate)}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    End Date
                  </p>
                  <p style={{ color: "var(--color-text-body)" }}>
                    {contract.endDate
                      ? formatDate(contract.endDate)
                      : "Open-ended"}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Account Code
                  </p>
                  <p
                    className="font-mono text-xs"
                    style={{ color: "var(--color-text-body)" }}
                  >
                    {contract.expenseAccountCode}
                  </p>
                </div>
              </div>

              {contract.autoRenew && (
                <p
                  className="text-xs italic"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  🔄 Auto-renew enabled
                </p>
              )}
            </div>

            <div className="ml-4 flex gap-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(contract)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onViewDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(contract)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
