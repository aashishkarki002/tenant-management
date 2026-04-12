import { getPaymentAmounts, normalizeStatus } from "./paymentUtil";

function unitSortKey(rent) {
  const u = rent.units?.map((x) => x.name).filter(Boolean).join(" ");
  if (u) return u;
  return rent.block?.name || rent.innerBlock?.name || "";
}

function dueSortKey(rent) {
  if (rent.nepaliDueDate) return rent.nepaliDueDate.split("T")[0];
  if (rent.nepaliYear != null && rent.nepaliMonth != null) {
    return `${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`;
  }
  if (rent.englishDueDate) return rent.englishDueDate.split("T")[0];
  return "";
}

/** Client-side sort for rent table columns. */
export function sortRents(rents, cams, key, dir) {
  if (!key) return rents;
  const mul = dir === "asc" ? 1 : -1;
  const arr = [...rents];
  arr.sort((a, b) => {
    switch (key) {
      case "tenant": {
        const an = (a.tenant?.name || "").toLowerCase();
        const bn = (b.tenant?.name || "").toLowerCase();
        return mul * an.localeCompare(bn);
      }
      case "unit": {
        return mul * unitSortKey(a).localeCompare(unitSortKey(b));
      }
      case "rent": {
        const av = getPaymentAmounts(a, cams).rentAmount;
        const bv = getPaymentAmounts(b, cams).rentAmount;
        return mul * (av - bv);
      }
      case "cam": {
        const av = getPaymentAmounts(a, cams).camAmount;
        const bv = getPaymentAmounts(b, cams).camAmount;
        return mul * (av - bv);
      }
      case "total": {
        const av = getPaymentAmounts(a, cams).totalDue;
        const bv = getPaymentAmounts(b, cams).totalDue;
        return mul * (av - bv);
      }
      case "dueDate": {
        return mul * dueSortKey(a).localeCompare(dueSortKey(b));
      }
      case "status": {
        const as = normalizeStatus(a.status);
        const bs = normalizeStatus(b.status);
        return mul * as.localeCompare(bs);
      }
      default:
        return 0;
    }
  });
  return arr;
}
