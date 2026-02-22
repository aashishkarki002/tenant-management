import { Tenant } from "../tenant/Tenant.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { LedgerEntry } from "../ledger/Ledger.Model.js";

/**
 * Global search across Tenants, Rents, and Ledger entries.
 * Uses MongoDB $text index (M0 compatible) + numeric fallback for amounts/years.
 *
 * @param {string} query  - raw search string from user
 * @param {number} limit  - max results per collection (default 5)
 */
export const globalSearch = async (query, limit = 5) => {
  const q = query?.trim();

  if (!q || q.length < 2) {
    return { results: [], total: 0 };
  }

  const isNumeric = !isNaN(q) && q.length > 0;

  // ── Run all searches in parallel ──────────────────────────────────────────
  const [tenants, rents, ledgerEntries] = await Promise.allSettled([
    // 1. Tenants — search by name, email, phone
    Tenant.find(
      {
        $text: { $search: q },
        isDeleted: false,
      },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .select("name email phone status property")
      .populate("property", "name")
      .lean(),

    // 2. Rents — text search on month name + numeric fallback for year/amount
    Rent.find({
      $or: [
        ...(isNumeric
          ? [{ nepaliYear: parseInt(q) }, { rentAmount: parseInt(q) }]
          : [{ $text: { $search: q } }]),
      ],
    })
      .limit(limit)
      .select("nepaliMonth nepaliYear rentAmount status tenant property")
      .populate("tenant", "name email")
      .populate("property", "name")
      .lean(),

    // 3. Ledger entries — search by description text
    LedgerEntry.find({ $text: { $search: q } })
      .limit(limit)
      .select(
        "description debitAmount creditAmount nepaliMonth nepaliYear tenant transactionDate",
      )
      .populate("tenant", "name")
      .lean(),
  ]);

  // ── Shape into a unified result format ────────────────────────────────────
  const shaped = [];

  if (tenants.status === "fulfilled") {
    tenants.value.forEach((t) => {
      shaped.push({
        _id: t._id,
        type: "tenant",
        label: t.name,
        sublabel: `${t.email} · ${t.phone ?? ""}`,
        badge: t.status,
        meta: t.property?.name ?? "",
        url: `/tenant/viewDetail/${t._id}`,
        score: t.score ?? 5,
      });
    });
  }

  if (rents.status === "fulfilled") {
    rents.value.forEach((r) => {
      shaped.push({
        _id: r._id,
        type: "rent",
        label: `${r.nepaliMonth} ${r.nepaliYear}`,
        sublabel: r.tenant?.name ?? "Unknown tenant",
        badge: r.status,
        meta: `Rs. ${r.rentAmount?.toLocaleString()}`,
        url: `/rent?tenantId=${r.tenant?._id}`,
        score: 2,
      });
    });
  }

  if (ledgerEntries.status === "fulfilled") {
    ledgerEntries.value.forEach((e) => {
      const amount = e.debitAmount > 0 ? e.debitAmount : e.creditAmount;
      const side = e.debitAmount > 0 ? "Dr" : "Cr";
      shaped.push({
        _id: e._id,
        type: "ledger",
        label: e.description,
        sublabel: e.tenant?.name ?? "No tenant",
        badge: `${side} Rs.${amount?.toLocaleString()}`,
        meta: `${e.nepaliMonth}/${e.nepaliYear}`,
        url: `/accounts/ledger`,
        score: 1,
      });
    });
  }

  // Sort by relevance score (text matches come first)
  shaped.sort((a, b) => b.score - a.score);

  return {
    results: shaped,
    total: shaped.length,
  };
};
