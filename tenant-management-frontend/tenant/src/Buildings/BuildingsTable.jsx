import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  ArrowRightLeft,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function BuildingsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" or "grid"
  const [migrationDialog, setMigrationDialog] = useState({
    open: false,
    building: null,
  });

  // Mock data - replace with actual API call
  const buildings = [
    {
      id: 1,
      name: "Sallyan House Main Building",
      address: "Boudha, Kathmandu",
      totalUnits: 12,
      occupiedUnits: 10,
      vacantUnits: 2,
      currentOwner: "Ram Sharma",
      monthlyRevenue: "NPR 240,000",
    },
    {
      id: 2,
      name: "Sallyan House Annex",
      address: "Boudha, Kathmandu",
      totalUnits: 8,
      occupiedUnits: 8,
      vacantUnits: 0,
      currentOwner: "Sita Thapa",
      monthlyRevenue: "NPR 160,000",
    },
    {
      id: 3,
      name: "Sallyan Commercial Complex",
      address: "Jorpati, Kathmandu",
      totalUnits: 6,
      occupiedUnits: 5,
      vacantUnits: 1,
      currentOwner: "Ram Sharma",
      monthlyRevenue: "NPR 180,000",
    },
  ];

  const filteredBuildings = buildings.filter((building) =>
    building.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMigrateClick = (building) => {
    setMigrationDialog({ open: true, building });
  };

  const handleViewDetails = (building) => {
    console.log("View details for:", building);
    // Navigate to building details page
  };

  const handleMigrationSubmit = (e) => {
    e.preventDefault();
    // Handle migration logic here
    console.log("Migrating building:", migrationDialog.building);
    setMigrationDialog({ open: false, building: null });
  };

  const getOccupancyRate = (occupied, total) => {
    return Math.round((occupied / total) * 100);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Buildings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your properties and ownership
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Building
          </Button>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search buildings..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select defaultValue="all">
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                <SelectItem value="occupied">Fully Occupied</SelectItem>
                <SelectItem value="vacant">Has Vacancies</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="name">
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="units">Unit Count</SelectItem>
                <SelectItem value="occupancy">Occupancy</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3",
                viewMode === "table" && "bg-background shadow-sm"
              )}
              onClick={() => setViewMode("table")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3",
                viewMode === "grid" && "bg-background shadow-sm"
              )}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Buildings Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Building Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-center">Occupancy</TableHead>
                <TableHead>Current Owner</TableHead>
                <TableHead className="text-right">Monthly Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBuildings.map((building) => {
                const occupancyRate = getOccupancyRate(
                  building.occupiedUnits,
                  building.totalUnits
                );

                return (
                  <TableRow key={building.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{building.name}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {building.address}
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">
                          {building.totalUnits}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {building.occupiedUnits} occupied
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium">
                          {occupancyRate}%
                        </span>
                        <Badge
                          variant={
                            building.vacantUnits === 0 ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {building.vacantUnits === 0
                            ? "Full"
                            : `${building.vacantUnits} vacant`}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">{building.currentOwner}</span>
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {building.monthlyRevenue}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(building)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMigrateClick(building)}
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(building)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleMigrateClick(building)}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-2" />
                              Migrate Ownership
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Empty State */}
        {filteredBuildings.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No buildings found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Buildings</p>
            <p className="text-2xl font-semibold">{buildings.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Units</p>
            <p className="text-2xl font-semibold">
              {buildings.reduce((acc, b) => acc + b.totalUnits, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Occupied Units</p>
            <p className="text-2xl font-semibold">
              {buildings.reduce((acc, b) => acc + b.occupiedUnits, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Occupancy</p>
            <p className="text-2xl font-semibold">
              {Math.round(
                (buildings.reduce((acc, b) => acc + b.occupiedUnits, 0) /
                  buildings.reduce((acc, b) => acc + b.totalUnits, 0)) *
                  100
              )}
              %
            </p>
          </div>
        </div>

        {/* Migration Dialog */}
        <Dialog
          open={migrationDialog.open}
          onOpenChange={(open) =>
            setMigrationDialog({
              open,
              building: open ? migrationDialog.building : null,
            })
          }
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Migrate Building Ownership</DialogTitle>
              <DialogDescription>
                Transfer ownership of this building to a new owner. All
                associated units, tenants, and financial records will be
                transferred.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleMigrationSubmit} className="space-y-4 py-4">
              {/* Current Building Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Building:</span>
                  <span className="font-medium">
                    {migrationDialog.building?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Owner:</span>
                  <span className="font-medium">
                    {migrationDialog.building?.currentOwner}
                  </span>
                </div>
              </div>

              {/* New Owner Select */}
              <div className="space-y-2">
                <Label htmlFor="newOwner">
                  New Owner <span className="text-destructive">*</span>
                </Label>
                <Select required>
                  <SelectTrigger id="newOwner">
                    <SelectValue placeholder="Select new owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user1">Krishna Bahadur</SelectItem>
                    <SelectItem value="user2">Gita Sharma</SelectItem>
                    <SelectItem value="user3">Hari Prasad</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transfer Date */}
              <div className="space-y-2">
                <Label htmlFor="transferDate">
                  Transfer Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transferDate"
                  type="date"
                  defaultValue="2026-03-27"
                  required
                />
              </div>

              {/* Transfer Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Transfer Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this ownership transfer..."
                  rows={3}
                />
              </div>

              {/* Warning */}
              <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                <div className="text-amber-600 dark:text-amber-500 mt-0.5">
                  ⚠️
                </div>
                <div className="text-sm text-amber-900 dark:text-amber-200">
                  This action will transfer all units (
                  {migrationDialog.building?.totalUnits}), tenants, and
                  financial records associated with this building. Please verify
                  the new owner before proceeding.
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setMigrationDialog({ open: false, building: null })
                  }
                >
                  Cancel
                </Button>
                <Button type="submit">Migrate Ownership</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
