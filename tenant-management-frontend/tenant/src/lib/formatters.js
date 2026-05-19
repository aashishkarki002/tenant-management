/** All money values are in paisa (integer). Never use floats. */

export function formatRupees(paisa) {
  if (paisa == null) return "Rs. 0";
  const rupees = Math.round(paisa) / 100;
  return "Rs. " + rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRupeesCompact(paisa) {
  if (paisa == null) return "Rs. 0";
  const rupees = Math.round(paisa) / 100;
  if (Math.abs(rupees) >= 10_000_000) {
    return "Rs. " + (rupees / 10_000_000).toFixed(2) + "Cr";
  }
  if (Math.abs(rupees) >= 100_000) {
    return "Rs. " + (rupees / 100_000).toFixed(2) + "L";
  }
  if (Math.abs(rupees) >= 1_000) {
    return "Rs. " + (rupees / 1_000).toFixed(1) + "K";
  }
  return "Rs. " + rupees.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatPaisaCompact(paisa) {
  return formatRupeesCompact(paisa);
}
