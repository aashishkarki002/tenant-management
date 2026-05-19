import RevenueCollectionBreakdown from "../RevenueCollectionBreakdown";

export default function RevenueCollectionTab({ filterProps }) {
    return (
        <div className="flex flex-col gap-4">
            <RevenueCollectionBreakdown {...filterProps} />
        </div>
    );
}
