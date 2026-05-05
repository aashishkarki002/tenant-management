import { TrendingUpIcon } from "lucide-react";
import RevenueBreakDown from "../RevenueBreakDown";


export default function RevenueTab({
    filterProps,
    filterLabel,
    totalRevenue,
    pendingAction,
    onDialogOpenHandled,
    onRevenueAdded,
}) {
    return (
        <div className="flex flex-col gap-4">

            <RevenueBreakDown
                onRevenueAdded={onRevenueAdded}
                {...filterProps}
                openDialog={pendingAction === "revenue"}
                onDialogOpenHandled={onDialogOpenHandled}
            />
        </div>
    );
}