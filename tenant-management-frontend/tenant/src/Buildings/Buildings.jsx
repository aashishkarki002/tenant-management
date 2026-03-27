import { useState } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Home,
  Users,
  ArrowRightLeft,
  Search,
  ChevronDown,
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Buildings() {
  const [searchTerm, setSearchTerm] = useState("");
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
    },
    {
      id: 2,
      name: "Sallyan House Annex",
      address: "Boudha, Kathmandu",
      totalUnits: 8,
      occupiedUnits: 8,
      vacantUnits: 0,
      currentOwner: "Sita Thapa",
    },
  ];

  const filteredBuildings = buildings.filter((building) =>
    building.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMigrateClick = (building) => {
    setMigrationDialog({ open: true, building });
  };

  const handleMigrationSubmit = (e) => {
    e.preventDefault();
    // Handle migration logic here
    console.log("Migrating building:", migrationDialog.building);
    setMigrationDialog({ open: false, building: null });
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

        {/* Filters */}
        <div className="flex gap-3">
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
            </SelectContent>
          </Select>
        </div>

        {/* Buildings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBuildings.map((building) => (
            <Card
              key={building.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                {/* Building Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">
                        {building.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {building.address}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Building Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{building.totalUnits}</span>{" "}
                      units
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>
                      <span className="font-medium">
                        {building.occupiedUnits}
                      </span>{" "}
                      occupied
                    </span>
                  </div>
                </div>

                {/* Occupancy Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge
                    variant={
                      building.vacantUnits === 0 ? "default" : "secondary"
                    }
                  >
                    {building.vacantUnits === 0
                      ? "Fully Occupied"
                      : `${building.vacantUnits} Vacant`}
                  </Badge>
                </div>

                {/* Current Owner */}
                <div className="p-3 bg-muted/50 rounded-md mb-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Current Owner
                  </p>
                  <p className="text-sm font-medium">{building.currentOwner}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleMigrateClick(building)}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Migrate Ownership
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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

        {/* Migration Dialog */}
        <Dialog
          open={migrationDialog.open}
          onOpenChange={(open) =>
            setMigrationDialog({ open, building: open ? migrationDialog.building : null })
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
                  This action will transfer all units ({migrationDialog.building?.totalUnits}), tenants, and financial records
                  associated with this building. Please verify the new owner
                  before proceeding.
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
