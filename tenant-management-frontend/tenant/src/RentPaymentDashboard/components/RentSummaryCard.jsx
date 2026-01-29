import React from "react";
import { CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RentFilter } from "./RentFilter";
/**
 * Component for displaying rent collection summary
 */
export const RentSummaryCard = ({
  totalCollected,
  totalDue,
  filterRentMonth,
  onMonthChange,
}) => {
  const progressPercentage = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;

  return (
    <div className="px-6 pt-6">
      <CardDescription className="text-gray-500 text-sm">
        Track monthly rent collection
        <RentFilter value={filterRentMonth} onMonthChange={onMonthChange} />
      </CardDescription>
      <div className="mt-2 text-sm text-muted-foreground">
        <strong>Total Collected:</strong>
        <Progress value={progressPercentage} className="h-2 w-full mt-2" />
        <span className="text-primary font-bold">
          ₹{totalCollected.toLocaleString()} / ₹{totalDue.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
