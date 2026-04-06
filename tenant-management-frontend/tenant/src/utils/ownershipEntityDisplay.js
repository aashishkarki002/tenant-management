/**
 * Display helpers for OwnershipEntity refs (e.g. populated `entityId` on bank accounts).
 */

/**
 * User-facing label for the entity `type` enum.
 * @param {string | undefined} type
 * @returns {string}
 */
export function getOwnershipTypeLabel(type) {
  switch (type) {
    case "private":
      return "Private";
    case "company":
      return "Company";
    case "head_office":
      return "Head Office";
    default:
      return type ? String(type) : "";
  }
}

/**
 * Short label for chips / badges: prefers entity name, else type-based fallback.
 * Matches legacy PaymentDialog behavior.
 * @param {object | string | null | undefined} entity - populated entity or id
 * @returns {string | null}
 */
export function getOwnershipLabel(entity) {
  if (!entity || typeof entity !== "object") return null;
  if (entity.name) return entity.name;
  if (entity.type === "head_office") return "HQ";
  if (entity.type === "company") return "Company";
  if (entity.type === "private") return "Private";
  return null;
}

/**
 * Primary line for bank account pickers: bank name, masked account tail, optional code.
 * @param {object} bank
 * @returns {string}
 */
export function formatBankAccountPrimaryLine(bank) {
  if (!bank || typeof bank !== "object") return "";
  const name = bank.bankName ?? bank.name ?? "";
  const tail = bank.accountNumber
    ? `****${String(bank.accountNumber).slice(-4)}`
    : "";
  const code = bank.accountCode ? String(bank.accountCode) : "";
  const parts = [name, tail].filter(Boolean);
  const main = parts.join(" ");
  return code ? `${main} · ${code}` : main;
}

/**
 * Secondary line: entity type (always when known) + entity name when distinct from type label.
 * @param {object | null | undefined} entity - populated entityId
 * @returns {string | null}
 */
export function formatOwnershipEntitySecondaryLine(entity) {
  if (!entity || typeof entity !== "object") return null;
  const typeLabel = getOwnershipTypeLabel(entity.type);
  const name = entity.name?.trim();
  if (typeLabel && name) {
    return `${typeLabel} · ${name}`;
  }
  if (typeLabel) return typeLabel;
  if (name) return name;
  return null;
}
