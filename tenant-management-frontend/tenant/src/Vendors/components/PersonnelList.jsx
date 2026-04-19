import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserX } from "lucide-react";
import { getPersonnelByContract, updatePersonnel } from "../services/vendorService";
import PersonnelForm from "./PersonnelForm";
import { toast } from "sonner";

const SHIFT_COLORS = {
  day: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", border: "var(--color-warning-border)" },
  night: { bg: "var(--color-info-bg)", text: "var(--color-info)", border: "var(--color-info-border)" },
  rotating: { bg: "var(--color-accent-bg)", text: "var(--color-accent)", border: "var(--color-accent-border)" },
};

const ID_LABELS = {
  citizenship: "Citizenship",
  passport: "Passport",
  driving_license: "Driving License",
  other: "Other",
};

export default function PersonnelList({ contract, vendorId }) {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const fetchPersonnel = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPersonnelByContract(contract._id);
      if (res.success) setPersonnel(res.personnel || []);
    } catch (err) {
      console.error("Failed to fetch personnel:", err);
    } finally {
      setLoading(false);
    }
  }, [contract._id]);

  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  const handleDeactivate = async (p) => {
    if (!confirm(`Remove ${p.name} from this contract?`)) return;
    try {
      await updatePersonnel(p._id, { isActive: false, assignedTo: new Date().toISOString().slice(0, 10) });
      toast.success(`${p.name} removed`);
      fetchPersonnel();
    } catch (err) {
      toast.error("Failed to remove personnel");
    }
  };

  return (
    <div
      className="mt-3 rounded-lg border p-3"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-sub)" }}>
          Assigned Personnel
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
        >
          <Plus className="h-3 w-3" />
          Assign
        </Button>
      </div>

      {loading ? (
        <p className="py-2 text-center text-xs" style={{ color: "var(--color-text-weak)" }}>
          Loading…
        </p>
      ) : personnel.length === 0 ? (
        <p className="py-3 text-center text-xs" style={{ color: "var(--color-text-weak)" }}>
          No personnel assigned yet
        </p>
      ) : (
        <div className="space-y-2">
          {personnel.map((p) => {
            const shiftColor = SHIFT_COLORS[p.shift] || SHIFT_COLORS.day;
            return (
              <div
                key={p._id}
                className="flex items-center justify-between rounded-md px-3 py-2"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-strong)" }}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.phone && (
                        <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>
                          {p.phone}
                        </span>
                      )}
                      {p.idNumber && (
                        <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>
                          {ID_LABELS[p.idType] || p.idType}: {p.idNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <Badge
                    className="text-xs capitalize"
                    style={{
                      backgroundColor: shiftColor.bg,
                      color: shiftColor.text,
                      border: `1px solid ${shiftColor.border}`,
                    }}
                  >
                    {p.shift}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => { setEditTarget(p); setFormOpen(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    style={{ color: "var(--color-danger)" }}
                    onClick={() => handleDeactivate(p)}
                  >
                    <UserX className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PersonnelForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        vendorId={vendorId}
        contractId={contract._id}
        personnel={editTarget}
        onSuccess={() => {
          setFormOpen(false);
          fetchPersonnel();
        }}
      />
    </div>
  );
}
