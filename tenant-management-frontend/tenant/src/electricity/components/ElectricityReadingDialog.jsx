import { useState, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Home, Building, Car, Zap, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import useUnits from "../../hooks/use-units";
import { useSubMeterOptions, filterSubMeterOptions } from "../utils/useSubMeterOptions";
import { createReading, getReadings } from "../utils/electricityApi";
import { getUnitsForInnerBlocks } from "../../Tenant/addTenant/utils/propertyHelper";
import DualCalendarTailwind from "../../components/dualDate";

const METER_TYPES = [
    { value: "unit", label: "Units", icon: Home },
    { value: "common_area", label: "Common Area", icon: Building },
    { value: "parking", label: "Parking", icon: Car },
    { value: "sub_meter", label: "Sub Meter", icon: Zap },
];

const EMPTY_FORM = {
    buildingId: "",
    blockId: "",
    innerBlockId: "",
    selected: "",       // unitId or subMeterId depending on tab
    reading: "",
    notes: "",
};

/**
 * ElectricityReadingDialog
 *
 * Industry pattern: the dialog owns form state; the parent owns data state.
 * On success the parent refetches via onSaved() — no prop-drilling of results.
 *
 * Meter-type branching:
 *   "unit"       → POST with { tenantId, unitId, meterType: "unit", ... }
 *   all others   → POST with { subMeterId, propertyId, meterType, ... }
 *   The controller validates each path independently (see electricity_controller.js).
 */
/** Parse "YYYY-MM-DD" (BS) into { year, month, day } for backend. */
function parseNepaliDateString(nepaliStr) {
    if (!nepaliStr || typeof nepaliStr !== "string") return null;
    const parts = nepaliStr.trim().split("-").map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    return { year, month, day };
}

/** Parse "YYYY-MM-DD" (AD) into { month, year } for backend. */
function parseEnglishDateString(englishStr) {
    if (!englishStr || typeof englishStr !== "string") return null;
    const parts = englishStr.trim().split("-").map(Number);
    if (parts.length !== 3) return null;
    const [year, month] = parts;
    if (!year || !month) return null;
    return { month, year };
}

export default function ElectricityReadingDialog({
    open,
    onOpenChange,
    allBlocks = [],
    property = [],
    /** Called after a reading is saved so the parent can refetch */
    onSaved,
}) {
    // ── Derive propertyId for units + sub-meter fetch ──────────────────────────
    const propertyId = useMemo(() => {
        if (!Array.isArray(property) || property.length === 0) return null;
        return property[0]?._id ?? null;
    }, [property]);

    // ── Units (tenant-billed) — need both unitId and tenantId for the POST ────
    const { units, loading: unitsLoading } = useUnits({
        propertyId: propertyId ?? undefined,
        occupied: undefined, // all units, not just occupied
    });

    // ── Sub-meter reference data (common_area / parking / sub_meter) ──────────
    const {
        byType: subMetersByType,
        loading: subMetersLoading,
    } = useSubMeterOptions(propertyId);

    const [selectedMeterType, setSelectedMeterType] = useState("unit");
    const [saving, setSaving] = useState(false);
    /** Reading date from dual calendar (AD and BS strings "YYYY-MM-DD") */
    const [readingDateEnglish, setReadingDateEnglish] = useState("");
    const [readingDateNepali, setReadingDateNepali] = useState("");

    const [formData, setFormData] = useState({
        unit: { ...EMPTY_FORM },
        common_area: { ...EMPTY_FORM },
        parking: { ...EMPTY_FORM },
        sub_meter: { ...EMPTY_FORM },
    });

    /** Previous reading for the selected meter (fetched when selection changes) */
    const [previousReading, setPreviousReading] = useState(null);
    const [previousReadingLoading, setPreviousReadingLoading] = useState(false);

    // ── Single building: set unit tab buildingId from propertyId ───────────────
    useEffect(() => {
        if (!propertyId) return;
        setFormData((prev) => ({
            ...prev,
            unit: prev.unit.buildingId ? prev.unit : { ...prev.unit, buildingId: propertyId },
        }));
    }, [propertyId]);

    // ── Fetch previous reading when unit/sub-meter is selected ─────────────────
    useEffect(() => {
        const selected = formData[selectedMeterType].selected;
        if (!propertyId || !selected) {
            setPreviousReading(null);
            return;
        }
        let cancelled = false;
        setPreviousReadingLoading(true);
        setPreviousReading(null);
        const params =
            selectedMeterType === "unit"
                ? { propertyId, unitId: selected, meterType: "unit" }
                : { propertyId, subMeterId: selected, meterType: selectedMeterType };
        getReadings(params)
            .then((data) => {
                if (cancelled) return;
                const list = data?.readings ?? [];
                const sorted = [...list].sort((a, b) => {
                    const da = new Date(a.readingDate || a.createdAt || 0);
                    const db = new Date(b.readingDate || b.createdAt || 0);
                    return db - da;
                });
                const latest = sorted[0];
                setPreviousReading(
                    latest != null && typeof latest.currentReading === "number"
                        ? latest.currentReading
                        : null
                );
            })
            .catch(() => {
                if (!cancelled) setPreviousReading(null);
            })
            .finally(() => {
                if (!cancelled) setPreviousReadingLoading(false);
            });
        return () => { cancelled = true; };
    }, [propertyId, selectedMeterType, formData[selectedMeterType].selected]);

    // ── Building / block cascade helpers ──────────────────────────────────────
    const buildings = useMemo(() => {
        if (!Array.isArray(property)) return [];
        return property.map((p) => ({
            _id: p._id,
            name: p.name ?? p.propertyName ?? p._id,
            blocks: p.blocks ?? [],
        }));
    }, [property]);

    const getBlocksForBuilding = (type) => {
        const { buildingId } = formData[type];
        if (!buildingId) return [];
        return buildings.find((b) => b._id === buildingId)?.blocks ?? [];
    };

    const getInnerBlocks = (type) => {
        const { buildingId, blockId } = formData[type];
        if (!buildingId || !blockId) return [];
        const building = buildings.find((b) => b._id === buildingId);
        const block = building?.blocks.find((bl) => bl._id === blockId);
        return Array.isArray(block?.innerBlocks) ? block.innerBlocks : [];
    };

    /**
     * Returns filtered item list for the active tab.
     *
     * Unit tab  → useUnits() result (tenant contracts, different domain).
     * All other → useSubMeterOptions() result (infrastructure config).
     *
     * Industry note: never mix domain data sources into a single list.
     * Separate fetches = separate caches, separate loading states.
     */
    /**
     * Unit options: same pattern as add tenant — filter by building, block, then by innerBlock.
     * When block has inner blocks, only show units for the selected inner block.
     */
    const getOptions = (type) => {
        const { buildingId, blockId, innerBlockId } = formData[type];

        if (type === "unit") {
            const byBuildingAndBlock = (units ?? []).filter((item) => {
                const matchBuilding = buildingId
                    ? (item.propertyId ?? item.property?._id ?? item.property) === buildingId
                    : true;
                const matchBlock = blockId
                    ? (item.blockId ?? item.block?._id ?? item.block) === blockId
                    : true;
                return matchBuilding && matchBlock;
            });
            // Same as add tenant: when block has inner blocks, only show units for selected inner block
            if (innerBlockId) {
                return getUnitsForInnerBlocks([innerBlockId], byBuildingAndBlock);
            }
            // No inner block selected: if block has inner blocks, show no units (user must pick inner block first)
            const innerBlocks = getInnerBlocks(type);
            if (innerBlocks.length > 0) return [];
            return byBuildingAndBlock;
        }

        const pool = subMetersByType[type] ?? [];
        return filterSubMeterOptions(pool, { blockId, innerBlockId });
    };

    // ── Form state helpers ────────────────────────────────────────────────────
    const update = (type, field, value) =>
        setFormData((prev) => ({
            ...prev,
            [type]: { ...prev[type], [field]: value },
        }));

    const handleBuildingChange = (type, buildingId) =>
        setFormData((prev) => ({
            ...prev,
            [type]: { ...EMPTY_FORM, buildingId },
        }));

    const handleBlockChange = (type, blockId) =>
        setFormData((prev) => ({
            ...prev,
            [type]: { ...prev[type], blockId, innerBlockId: "", selected: "" },
        }));

    const handleInnerBlockChange = (type, innerBlockId) =>
        setFormData((prev) => ({
            ...prev,
            [type]: { ...prev[type], innerBlockId, selected: "" },
        }));

    const handleClose = () => {
        if (!saving) onOpenChange(false);
    };

    const canSave = Boolean(
        readingDateNepali &&
        readingDateEnglish &&
        formData[selectedMeterType].selected &&
        formData[selectedMeterType].reading !== "" &&
        parseFloat(formData[selectedMeterType].reading) >= 0
    );

    // ── Submit ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        const data = formData[selectedMeterType];
        const currentReading = parseFloat(data.reading);

        const nepaliParsed = parseNepaliDateString(readingDateNepali);
        const englishParsed = parseEnglishDateString(readingDateEnglish);
        if (!nepaliParsed || !englishParsed) {
            toast.error("Please select a reading date (Nepali & English).");
            return;
        }
        if (!canSave || Number.isNaN(currentReading)) {
            toast.error("Please fill in all required fields.");
            return;
        }

        const { year: nepaliYear, month: nepaliMonth } = nepaliParsed;
        const { year: englishYear, month: englishMonth } = englishParsed;

        setSaving(true);
        try {
            if (selectedMeterType === "unit") {
                /**
                 * Unit reading — must resolve tenantId from the selected unit.
                 * The unit object from useUnits carries the active tenant reference.
                 * If no tenant is found the backend will reject with a clear message.
                 */
                const selectedUnit = (units ?? []).find((u) => u._id === data.selected);
                const tenantId =
                    selectedUnit?.currentLease?.tenant ??
                    selectedUnit?.tenantId ??
                    selectedUnit?.tenant?._id ??
                    selectedUnit?.tenant ??
                    undefined;

                await createReading({
                    meterType: "unit",
                    ...(tenantId != null && { tenantId }),
                    unitId: data.selected,
                    propertyId,
                    currentReading,
                    nepaliMonth,
                    nepaliYear,
                    nepaliDate: readingDateNepali,
                    englishMonth,
                    englishYear,
                    notes: data.notes || undefined,
                });
            } else {
                /**
                 * Sub-meter reading (common_area | parking | sub_meter).
                 * billTo "property" — no tenant involved.
                 * The controller resolves the rate from ElectricityRate config.
                 */
                await createReading({
                    meterType: selectedMeterType,
                    subMeterId: data.selected,
                    propertyId,
                    currentReading,
                    nepaliMonth,
                    nepaliYear,
                    nepaliDate: readingDateNepali,
                    englishMonth,
                    englishYear,
                    notes: data.notes || undefined,
                });
            }

            toast.success("Reading saved successfully.");

            // Reset only the active tab's form and reading date
            setFormData((prev) => ({
                ...prev,
                [selectedMeterType]: { ...EMPTY_FORM },
            }));
            setReadingDateEnglish("");
            setReadingDateNepali("");

            onSaved?.();       // signal parent to refetch
            onOpenChange(false);
        } catch (err) {
            toast.error(err?.message || "Failed to save reading.");
        } finally {
            setSaving(false);
        }
    };

    // ── Render per-tab form ───────────────────────────────────────────────────
    const renderFilters = (type) => {
        const blocks = getBlocksForBuilding(type);
        const innerBlocks = getInnerBlocks(type);
        const options = getOptions(type);
        const { buildingId, blockId, innerBlockId, selected, reading, notes } = formData[type];

        const isSubMeterTab = type !== "unit";
        const isLoading = (type === "unit" && unitsLoading) || (isSubMeterTab && subMetersLoading);

        const labelMap = {
            unit: "Unit",
            common_area: "Common Area",
            parking: "Parking Spot",
            sub_meter: "Sub Meter",
        };
        const itemLabel = labelMap[type] ?? type;

        return (
            <div className="flex flex-col gap-4 mt-3">

                {/* Block — cascades from building (unit tab uses constant propertyId; sub-meters filter by block) */}
                {(buildingId && blocks.length > 0) ? (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Building</label>
                        <Select
                            value={blockId || ""}
                            onValueChange={(val) => handleBlockChange(type, val)}
                        >
                            <SelectTrigger className="h-9 bg-gray-100">
                                <SelectValue placeholder="Select Building" />
                            </SelectTrigger>
                            <SelectContent>
                                {blocks.map((bl) => (
                                    <SelectItem key={bl._id} value={bl._id}>{bl.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : isSubMeterTab && allBlocks.length > 0 && (
                    /* Sub-meter tabs: optional block filter without requiring a building */
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Building (optional)</label>
                        <Select
                            value={blockId || "__all__"}
                            onValueChange={(val) =>
                                handleBlockChange(type, val === "__all__" ? "" : val)
                            }
                        >
                            <SelectTrigger className="h-9 bg-gray-100">
                                <SelectValue placeholder="All Buildings" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Buildings</SelectItem>
                                {allBlocks.map((bl) => (
                                    <SelectItem key={bl._id} value={bl._id}>{bl.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Inner Block — same cascade as add tenant; changing it clears unit selection */}
                {blockId && innerBlocks.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Block</label>
                        <Select
                            value={innerBlockId || ""}
                            onValueChange={(val) => handleInnerBlockChange(type, val)}
                        >
                            <SelectTrigger className="h-9 bg-gray-100">
                                <SelectValue placeholder="Select Block" />
                            </SelectTrigger>
                            <SelectContent>
                                {innerBlocks.map((ib) => (
                                    <SelectItem key={ib._id} value={ib._id}>{ib.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Item select */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                        Select {itemLabel}
                        {isLoading && (
                            <Loader2 className="inline ml-2 w-3 h-3 animate-spin text-gray-400" />
                        )}
                    </label>
                    <Select
                        value={selected || ""}
                        onValueChange={(val) => update(type, "selected", val)}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="h-9 bg-gray-100">
                            <SelectValue placeholder={isLoading ? "Loading…" : `Select ${itemLabel}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {options.length > 0 ? (
                                options.map((opt) => (
                                    <SelectItem key={opt._id} value={opt._id}>
                                        {/* Sub-meters expose displayName; units expose unitName/name */}
                                        {opt.displayName ?? opt.name ?? opt.unitName ?? opt._id}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="__none__" disabled>
                                    {isLoading ? "Loading…" : `No ${itemLabel.toLowerCase()}s found`}
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Previous reading (when a meter is selected) */}
                {(selected && (type === selectedMeterType)) && (
                    <div className="text-sm text-muted-foreground">
                        {previousReadingLoading ? (
                            <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Previous reading…
                            </span>
                        ) : previousReading != null ? (
                            <>Previous reading: <span className="font-medium text-foreground">{Number(previousReading).toFixed(1)} kWh</span></>
                        ) : (
                            "Previous reading: —"
                        )}
                    </div>
                )}

                {/* Current Reading */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Current Reading (kWh)</label>
                    <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={reading}
                        onChange={(e) => update(type, "reading", e.target.value)}
                        placeholder="Enter current meter reading"
                        className="h-9 bg-gray-100"
                    />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                        value={notes}
                        onChange={(e) => update(type, "notes", e.target.value)}
                        placeholder="Any additional notes…"
                        className="bg-gray-100 resize-none"
                        rows={3}
                    />
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-full max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Electricity Reading</DialogTitle>
                    <DialogDescription>
                        Select a meter type, then choose the specific{" "}
                        {selectedMeterType.replace("_", " ")} and enter its reading.
                    </DialogDescription>
                </DialogHeader>

                {/* Reading date (Nepali + English) — required by backend */}


                <Tabs value={selectedMeterType} onValueChange={setSelectedMeterType}>
                    <TabsList className="bg-gray-100 rounded-lg gap-1 w-full">
                        {METER_TYPES.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="flex items-center gap-1.5 flex-1"
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Reading Date</label>
                        <DualCalendarTailwind
                            value={readingDateEnglish}
                            onChange={(english, nepali) => {
                                setReadingDateEnglish(english || "");
                                setReadingDateNepali(nepali || "");
                            }}
                        />
                    </div>

                    {METER_TYPES.map(({ value }) => (
                        <TabsContent key={value} value={value}>
                            {renderFilters(value)}
                        </TabsContent>
                    ))}
                </Tabs>

                <DialogFooter className="gap-2 mt-2">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={!canSave || saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            "Save Reading"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}