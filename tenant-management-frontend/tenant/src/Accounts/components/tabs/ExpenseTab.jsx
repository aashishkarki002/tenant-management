import ExpenseBreakDown from "../ExpenseBreakDown";
export default function ExpensesTab({
    filterProps,
    filterLabel,
    totalExpenses,
    pendingAction,
    onDialogOpenHandled,
    onExpenseAdded,
}) {
    return (
        <div className="flex flex-col gap-4">

            <ExpenseBreakDown
                onExpenseAdded={onExpenseAdded}
                {...filterProps}
                openDialog={pendingAction === "expense"}
                onDialogOpenHandled={onDialogOpenHandled}
            />
        </div>
    );
}