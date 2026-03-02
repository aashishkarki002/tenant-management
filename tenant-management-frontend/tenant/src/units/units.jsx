import { useState, useMemo } from "react";
import { PropertyStatsPanel } from "./components/PropertyStatsPanel";
import { FloorPlanView } from "./components/FloorPlanView";
import { UnitDetailsDrawer } from "./components/UnitDetailsDrawer";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import useProperty from "../hooks/use-property";
import { useUnits } from "../hooks/use-units";

function assignPositions(units = []) {
    return units.map(unit => {
        let wing = "top";

        if (unit.buildingName === "Narendra Sadhan") {
            // Split this building across top and left
            wing = unit.floor % 2 === 0 ? "left" : "top";
        }

        if (unit.buildingName === "Birendra Sadhan") {
            // Split this building across right and bottom
            wing = unit.floor % 2 === 0 ? "bottom" : "right";
        }

        return {
            ...unit,
            wing
        };
    });
}

// ─── DB → UI transformer ──────────────────────────────────────────────────────

function transformUnit(unit) {
    const lease = unit.currentLease;

    let status = "vacant";
    if (unit.isOccupied && lease?.status === "active") status = "occupied";
    else if (unit.isOccupied && lease?.status === "notice_period") status = "reserved";

    return {
        id: unit.name,
        _id: unit._id,
        buildingId: unit.building?._id ?? unit.building,
        floor: unit.floorNumber ?? 1,
        block: unit.block?.name ?? unit.block ?? "",
        innerBlock: unit.innerBlock?.name ?? unit.innerBlock ?? "",
        status,
        tenant: lease?.tenant
            ? { name: lease.tenant.name, phone: lease.tenant.phone, email: lease.tenant.email }
            : null,
        rentAmount: lease?.totalMonthly ?? null,
        paidAmount: null,
        remainingAmount: 0,
        dueDate: lease?.leaseEndDate
            ? new Date(lease.leaseEndDate).toISOString().split("T")[0]
            : null,
        lastPaymentDate: null,
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Units() {
    const [selectedUnit, setSelectedUnit] = useState(null);

    const { property, buildings, loading: propLoading } = useProperty();

    // Passes propertyId once property loads; useUnits skips fetch if empty object
    const { units: rawUnits, loading: unitsLoading } = useUnits(
        property ? { propertyId: property._id } : {}
    );

    const units = useMemo(() => {
        if (!rawUnits) return [];
        return assignPositions(rawUnits.map(transformUnit));
    }, [rawUnits]);

    const stats = useMemo(() => {
        const occupied = units.filter((u) => u.status === "occupied").length;
        const vacant = units.filter((u) => u.status === "vacant").length;
        const overdue = units.filter((u) => u.status === "overdue").length;
        const reserved = units.filter((u) => u.status === "reserved").length;
        const ownerOccupied = units.filter((u) => u.status === "owner-occupied").length;
        const totalUnits = units.length;
        const occupancyRate = totalUnits > 0
            ? Math.round(((occupied + ownerOccupied) / totalUnits) * 100)
            : 0;
        return { totalUnits, occupied, vacant, overdue, reserved, ownerOccupied, occupancyRate };
    }, [units]);

    if (propLoading || unitsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-gray-50 to-emerald-50">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500 text-sm">Loading property data…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen  via-gray-50 to-emerald-50">
            <div className="flex">

                <FloorPlanView
                    units={units}
                    buildings={buildings}
                    property={property}
                    stats={stats}
                    onUnitClick={setSelectedUnit}
                />

                {selectedUnit && (
                    <UnitDetailsDrawer
                        unit={selectedUnit}
                        onClose={() => setSelectedUnit(null)}
                    />
                )}
            </div>
        </div>
    );
}