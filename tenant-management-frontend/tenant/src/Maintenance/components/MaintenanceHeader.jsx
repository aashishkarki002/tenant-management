import React from "react";
import { LayoutGrid, LayoutList } from "lucide-react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export const MaintenanceHeader = ({
  viewMode,
  setViewMode,
  rightContent,
}) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* Left section */}
      <div>
        <h1 className="text-2xl font-bold text-text-strong sm:text-3xl">
          Maintenance
        </h1>
        <p className="mt-1 text-sm text-text-sub">
          Manage repair requests and track maintenance tasks
        </p>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value) setViewMode(value);
          }}
          className="rounded-lg border border-muted-fill bg-muted-fill/50 p-0.5"
        >
          <ToggleGroupItem
            value="table"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
         "
          >
            <LayoutList className="h-3.5 w-3.5" />
            Table
          </ToggleGroupItem>
          <ToggleGroupItem
            value="cards"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
           "
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </ToggleGroupItem>


        </ToggleGroup>

        {rightContent}
      </div>
    </div>
  );
};