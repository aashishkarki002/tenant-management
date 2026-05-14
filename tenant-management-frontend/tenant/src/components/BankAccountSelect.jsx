import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBankAccountPrimaryLine,
  formatOwnershipEntitySecondaryLine,
} from "@/utils/ownershipEntityDisplay.js";

/**
 * Dropdown of bank accounts with ownership entity type/name on each option.
 *
 * @param {object} props
 * @param {Array<object>} props.bankAccounts
 * @param {string} props.value - selected BankAccount _id
 * @param {(id: string) => void} props.onValueChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.id]
 * @param {string} [props.className]
 * @param {string} [props.triggerClassName]
 * @param {string} [props.emptyMessage]
 * @param {boolean} [props.showBalance] - show balance in rupees (from balancePaisa or balance)
 */
export default function BankAccountSelect({
  bankAccounts = [],
  value = "",
  onValueChange,
  placeholder = "Select bank account",
  disabled = false,
  id,
  className,
  triggerClassName,
  emptyMessage = "No bank accounts found. Add one in Settings or choose another payment method.",
  showBalance = false,
}) {
  if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return (
      <p
        className={`text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 ${className ?? ""}`}
      >
        {emptyMessage}
      </p>
    );
  }

  const rupeesFromBank = (bank) => {
    if (bank.balancePaisa != null && Number.isFinite(Number(bank.balancePaisa))) {
      return Number(bank.balancePaisa) / 100;
    }
    if (bank.balance != null && Number.isFinite(Number(bank.balance))) {
      return Number(bank.balance);
    }
    return 0;
  };

  return (
    <Select
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={`min-h-[64px] px-4 py-3 ${triggerClassName ?? className}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {bankAccounts.map((bank) => {
          const primary = formatBankAccountPrimaryLine(bank);
          const secondary = formatOwnershipEntitySecondaryLine(bank.entityId);
          const bal = showBalance ? rupeesFromBank(bank) : null;
          const metaRow = secondary || showBalance;
          return (
            <SelectItem key={bank._id} value={String(bank._id)} data-entity={bank.entityId?.type ?? 'private'} className="py-2.5">
              <div className="flex flex-col gap-0.5 text-left min-w-0">
                <span className="text-sm font-medium leading-tight truncate">
                  {primary}
                </span>
                {metaRow && (
                  <div className="flex items-start justify-between gap-2">
                    {secondary ? (
                      <span className="text-[11px] text-entity bg-entity leading-snug">
                        {secondary}
                      </span>
                    ) : (
                      <span />
                    )}
                    {showBalance && (
                      <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                        Rs {bal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
