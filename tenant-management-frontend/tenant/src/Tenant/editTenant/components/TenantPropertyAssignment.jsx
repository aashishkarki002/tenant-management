import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Combobox,
    ComboboxContent,
    ComboboxItem,
    ComboboxList,
    ComboboxChips,
    ComboboxChip,
    ComboboxChipsInput,
    ComboboxEmpty,
    ComboboxValue,
    useComboboxAnchor,
} from "@/components/ui/combobox.jsx";
import {
    Building2,
    ChevronRight,
    LayoutGrid,
    Plus,
    Pencil,
    AlertTriangle,
    CheckCircle2,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useProperty from "../../../hooks/use-property";
import { useUnits } from "../../../hooks/use-units";
import {
    getAllBlocks,
    getInnerBlocksForBlock,
    getUnitsForInnerBlocks,
} from "../../addTenant/utils/propertyHelper";

// ─── Current Assignment Summary ──────────────────────────────────────────────

function AssignmentBreadcrumb({ building, block, units }) {
    const hasAssignment = building || block || (units && units.length > 0);

    if (!hasAssignment) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                <Building2 className="h-4 w-4 shrink-0" />
                No property assigned yet
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium">
            {building && (
                <>
                    <span className="flex items-center gap-1.5 text-foreground">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {building}
                    </span>
                </>
            )}
            {block && (
                <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{block}</span>
                </>
            )}
            {units && units.length > 0 && (
                <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 flex-wrap">
                        {units.map((u) => (
                            <span
                                key={u}
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full border border-primary/20"
                            >
                                <LayoutGrid className="h-3 w-3" />
                                {u}
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Shared Selectors ─────────────────────────────────────────────────────────

function AssignmentSelectors({ formik, allBlocks, changedFields, originalTenant, property }) {
    const innerBlocks = getInnerBlocksForBlock(formik.values.block, property || []);

    const { units = [], loading: unitsLoading } = useUnits({
        blockId: formik.values.block || undefined,
        skip: !formik.values.block,
    });

    const availableUnits = formik.values.innerBlock
        ? getUnitsForInnerBlocks([formik.values.innerBlock], units)
        : [];

    const selectedUnitIds = Array.isArray(formik.values.unitNumber)
        ? formik.values.unitNumber
        : [];

    const anchor = useComboboxAnchor();

    const blockChanged = changedFields?.block;
    const innerBlockChanged = changedFields?.innerBlock;
    const unitsChanged = changedFields?.unitNumber;

    const originalBlockName = originalTenant?.block?.name || originalTenant?.block || "";
    const originalInnerBlockName = originalTenant?.innerBlock?.name || originalTenant?.innerBlock || "";
    const originalUnitNames = originalTenant?.units?.map((u) => u.name || u).join(", ") || "";

    return (
        <div className="space-y-3">
            {/* Building */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Building
                    </Label>
                    {blockChanged && originalBlockName && (
                        <span className="text-xs text-muted-foreground">
                            Was: <span className="font-medium">{originalBlockName}</span>
                        </span>
                    )}
                </div>
                <Select
                    value={formik.values.block}
                    onValueChange={(value) => {
                        formik.setFieldValue("block", value);
                        formik.setFieldValue("innerBlock", "");
                        formik.setFieldValue("unitNumber", []);
                    }}
                >
                    <SelectTrigger className={cn(blockChanged && "ring-1 ring-amber-400 border-amber-300")}>
                        <SelectValue placeholder="Select a building…" />
                    </SelectTrigger>
                    <SelectContent>
                        {allBlocks.map((block) => (
                            <SelectItem key={block._id} value={block._id}>
                                {block.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Inner Block — only shown once building is chosen */}
            {formik.values.block && (
                <div className="space-y-1.5 pl-4 border-l-2 border-muted">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Floor / Block
                        </Label>
                        {innerBlockChanged && originalInnerBlockName && (
                            <span className="text-xs text-muted-foreground">
                                Was: <span className="font-medium">{originalInnerBlockName}</span>
                            </span>
                        )}
                    </div>
                    <Select
                        value={formik.values.innerBlock}
                        onValueChange={(value) => {
                            formik.setFieldValue("innerBlock", value);
                            formik.setFieldValue("unitNumber", []);
                        }}
                    >
                        <SelectTrigger className={cn(innerBlockChanged && "ring-1 ring-amber-400 border-amber-300")}>
                            <SelectValue placeholder="Select a floor or block…" />
                        </SelectTrigger>
                        <SelectContent>
                            {innerBlocks.map((ib) => (
                                <SelectItem key={ib._id} value={ib._id}>
                                    {ib.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Units — only shown once inner block is chosen */}
            {formik.values.innerBlock && (
                <div className="space-y-1.5 pl-8 border-l-2 border-muted">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Units
                            {unitsLoading && (
                                <span className="ml-2 font-normal normal-case text-muted-foreground">
                                    loading…
                                </span>
                            )}
                        </Label>
                        {unitsChanged && originalUnitNames && (
                            <span className="text-xs text-muted-foreground">
                                Was: <span className="font-medium">{originalUnitNames}</span>
                            </span>
                        )}
                    </div>

                    <Combobox
                        multiple
                        autoHighlight
                        items={availableUnits.map((u) => String(u._id))}
                        value={selectedUnitIds}
                        onValueChange={(value) => formik.setFieldValue("unitNumber", value)}
                    >
                        <ComboboxChips
                            ref={anchor}
                            className={cn(
                                "w-full min-h-10",
                                unitsChanged && "ring-1 ring-amber-400 border-amber-300"
                            )}
                        >
                            <ComboboxValue>
                                {(values) => (
                                    <>
                                        {values.map((unitId) => {
                                            const unit = availableUnits.find(
                                                (u) => String(u._id) === String(unitId)
                                            );
                                            if (!unit) return null;
                                            return (
                                                <ComboboxChip key={unitId} value={unitId}>
                                                    {unit.name}
                                                </ComboboxChip>
                                            );
                                        })}
                                        <ComboboxChipsInput placeholder={selectedUnitIds.length === 0 ? "Pick one or more units…" : ""} />
                                    </>
                                )}
                            </ComboboxValue>
                        </ComboboxChips>

                        <ComboboxContent anchor={anchor}>
                            <ComboboxEmpty>No units found in this block.</ComboboxEmpty>
                            <ComboboxList>
                                {(id) => {
                                    const unit = availableUnits.find(
                                        (u) => String(u._id) === String(id)
                                    );
                                    if (!unit) return null;
                                    return (
                                        <ComboboxItem key={id} value={id}>
                                            {unit.name}
                                        </ComboboxItem>
                                    );
                                }}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>

                    <p className="text-xs text-muted-foreground">
                        You can select multiple units for tenants leasing more than one space.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function TenantPropertyAssignment({ formik, originalTenant, showComparison, changedFields }) {
    const [mode, setMode] = useState(null); // null | "edit" | "add"
    const { property } = useProperty();
    const allBlocks = getAllBlocks(property || []);

    // Resolve human-readable names for the current form values
    const currentBuildingName = allBlocks.find(b => b._id === formik.values.block)?.name
        || originalTenant?.block?.name
        || "";

    const allInnerBlocks = getInnerBlocksForBlock(formik.values.block, property || []);
    const currentBlockName = allInnerBlocks.find(ib => ib._id === formik.values.innerBlock)?.name
        || originalTenant?.innerBlock?.name
        || "";

    // Fetch units to resolve unit names from IDs
    const { units = [] } = useUnits({
        blockId: formik.values.block || undefined,
        skip: !formik.values.block,
    });

    const selectedUnitIds = Array.isArray(formik.values.unitNumber) ? formik.values.unitNumber : [];
    const availableUnits = formik.values.innerBlock
        ? getUnitsForInnerBlocks([formik.values.innerBlock], units)
        : [];

    const selectedUnitNames = selectedUnitIds.map(id => {
        const found = availableUnits.find(u => String(u._id) === String(id));
        return found?.name || id;
    });

    const hasAssignment = formik.values.block || formik.values.innerBlock || selectedUnitIds.length > 0;
    const assignmentChanged = changedFields?.block || changedFields?.innerBlock || changedFields?.unitNumber;

    const handleCancelEdit = () => {
        // Restore original values
        formik.setFieldValue("block", originalTenant?.block?._id || originalTenant?.block || "");
        formik.setFieldValue("innerBlock", originalTenant?.innerBlock?._id || originalTenant?.innerBlock || "");
        formik.setFieldValue("unitNumber", originalTenant?.units?.map(u => String(u._id || u)) || []);
        setMode(null);
    };

    return (
        <div className="space-y-4">
            {/* ── What is this? ─────────────────────────────────────────────── */}
            <p className="text-sm text-muted-foreground leading-relaxed">
                Property assignment links this tenant to a specific building, floor/block, and one or
                more units. The assignment determines which spaces are billed to this tenant.
            </p>

            {/* ── Current Assignment ────────────────────────────────────────── */}
            <div className={cn(
                "rounded-lg border bg-muted/30 px-4 py-3 space-y-3",
                assignmentChanged && "border-amber-300 bg-amber-50/50"
            )}>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current Assignment
                    </span>
                    {assignmentChanged && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                            Modified
                        </Badge>
                    )}
                </div>

                <AssignmentBreadcrumb
                    building={currentBuildingName}
                    block={currentBlockName}
                    units={selectedUnitNames}
                />

                {selectedUnitIds.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {selectedUnitIds.length === 1
                            ? "1 unit assigned"
                            : `${selectedUnitIds.length} units assigned`}
                    </div>
                )}
            </div>

            {/* ── Action Buttons (when no mode is active) ───────────────────── */}
            {mode === null && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMode("edit")}
                        className="gap-2"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Modify Assignment
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMode("add")}
                        className="gap-2"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Lease a New Unit
                    </Button>
                </div>
            )}

            {/* ── Edit Mode ─────────────────────────────────────────────────── */}
            {mode === "edit" && (
                <div className="rounded-lg border border-muted bg-background p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold">Modify Assignment</p>
                            <p className="text-xs text-muted-foreground">
                                Reassign the tenant to a different building, floor, or unit.
                                Any unsaved changes can be cancelled below.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            aria-label="Cancel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                            Changing the building will reset the floor and unit selections.
                            Financials tied to specific units may need to be updated separately.
                        </span>
                    </div>

                    <AssignmentSelectors
                        formik={formik}
                        allBlocks={allBlocks}
                        changedFields={changedFields}
                        originalTenant={originalTenant}
                        property={property}
                    />

                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setMode(null)}
                            disabled={!formik.values.block || !formik.values.innerBlock || selectedUnitIds.length === 0}
                        >
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Add New Unit Mode ─────────────────────────────────────────── */}
            {mode === "add" && (
                <div className="rounded-lg border border-muted bg-background p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold">Lease a New Unit</p>
                            <p className="text-xs text-muted-foreground">
                                Add an additional unit to this tenant's existing lease.
                                Select a building, floor, then choose the unit(s) to add.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMode(null)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            aria-label="Cancel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Explain: same block = just pick more units; different block = new selection */}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                        <Plus className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                        <span>
                            If the new unit is in the <strong>same building and floor</strong>, simply
                            select it from the units picker above. To lease a unit in a{" "}
                            <strong>different building</strong>, choose the new building below — this
                            will replace the current assignment.
                        </span>
                    </div>

                    <AssignmentSelectors
                        formik={formik}
                        allBlocks={allBlocks}
                        changedFields={changedFields}
                        originalTenant={originalTenant}
                        property={property}
                    />

                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setMode(null)}
                            disabled={selectedUnitIds.length === 0}
                        >
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TenantPropertyAssignment;
