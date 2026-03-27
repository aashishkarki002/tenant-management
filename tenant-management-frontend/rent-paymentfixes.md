# EasyManage — Rent & Payments Flow: Fix Spec

> **Scope:** `RentPayment.jsx`, `PaymentHistory.jsx` (Payments tab), and `PaymentDetail.jsx` (Receipt page)  
> **Priority:** P0 → P1 → P2 → P3

---

## P0 — Fix Immediately (Blocking)

### 1. Receipt: Raw database key leaking as field label

**File:** `PaymentDetail.jsx`

**Problem:** Field label renders as `BankName_Type:` — this is a raw schema key, not a user-facing label. Also `Date AD :` has a stray space before the colon.

**Fix:**

```jsx
// ❌ Before
<span className="label">BankName_Type:</span>
<span className="label">Date AD :</span>

// ✅ After
<span className="label">Bank:</span>
<span className="label">Date (AD):</span>
<span className="label">Date (BS):</span>
```

Apply the same audit to all field labels — replace any `snake_case` or `camelCase` keys with proper Title Case display labels.

---

### 2. Receipt: Property name renders in lowercase

**File:** `PaymentDetail.jsx`

**Problem:** `sallyan house` renders lowercase on an official receipt. Should match brand casing.

**Fix:**

```jsx
// Option A — fix at render (CSS)
<h2 className="property-name" style={{ textTransform: "capitalize" }}>
  {propertyName}
</h2>

// Option B — fix at data layer (preferred)
// Ensure the property name is stored/returned as "Sallyan House" from the API
```

---

### 3. Receipt: Empty `Phone Number:` field renders with no value

**File:** `PaymentDetail.jsx`

**Problem:** When phone is null/undefined, the label still renders with no value — looks like a broken UI.

**Fix:**

```jsx
// Conditionally render OR show fallback
{
  tenant.phone ? (
    <div className="field">
      <span className="label">Phone Number:</span>
      <span className="value">{tenant.phone}</span>
    </div>
  ) : (
    <div className="field">
      <span className="label">Phone Number:</span>
      <span className="value text-muted">—</span>
    </div>
  );
}
```

---

### 4. Receipt: Total amount clipped at bottom of page

**File:** `PaymentDetail.jsx`

**Problem:** The amount row (₹15,000) is cut off — likely due to a fixed height container or `overflow: hidden` on the receipt card.

**Fix:**

```jsx
// Remove any fixed height on the receipt container
// ❌ Before
<div className="receipt-body" style={{ height: '480px', overflow: 'hidden' }}>

// ✅ After
<div className="receipt-body" style={{ minHeight: '480px', overflowY: 'auto' }}>

// Also ensure the outer page wrapper allows full scroll
<div className="receipt-page" style={{ overflowY: 'auto', paddingBottom: '2rem' }}>
```

---

## P1 — Fix This Sprint

### 5. Receipt: Missing billing period field

**File:** `PaymentDetail.jsx`

**Problem:** Receipt shows _when_ payment was made but not _which month's rent_ it covers. These are different facts.

**Fix — Add to TRANSACTION DETAILS section:**

```jsx
<div className="field">
  <span className="label">Billing Period:</span>
  <span className="value">
    {payment.billingPeriod} {payment.billingYear}
  </span>
  {/* e.g. "Falgun 2082" */}
</div>
```

Ensure `billingPeriod` and `billingYear` (or a combined `forPeriod` field) is returned from the payment API response.

---

### 6. Receipt: No breadcrumb / back navigation

**File:** `PaymentDetail.jsx`

**Problem:** Full app header with nav disappears on this page. Users are stranded with no way back except the browser back button.

**Fix — Add breadcrumb at top of page:**

```jsx
<nav className="breadcrumb text-sm text-muted mb-4">
  <Link to="/rent-payment">Rent & Payments</Link>
  <span className="mx-2">›</span>
  <Link to="/rent-payment?tab=payments">Payments</Link>
  <span className="mx-2">›</span>
  <span>{tenant.fullName}</span>
</nav>
```

Also restore the main app header/layout wrapper on this page if it was intentionally stripped — confirm `AppLayout` wraps `PaymentDetail`.

---

### 7. Receipt: "History" panel with no data is confusing

**File:** `PaymentDetail.jsx`

**Problem:** `HISTORY` section shows "No activity history yet" with no label explaining what kind of history this tracks.

**Fix — Two options:**

**Option A (quick):** Hide the panel entirely until there is data:

```jsx
{
  activityHistory.length > 0 && (
    <div className="history-panel">
      <h4>HISTORY</h4>
      {activityHistory.map((entry) => (
        <HistoryEntry key={entry.id} {...entry} />
      ))}
    </div>
  );
}
```

**Option B (better):** Add a subtitle explaining what it tracks, and auto-log actions:

```jsx
<div className="history-panel">
  <h4>HISTORY</h4>
  <p className="text-muted text-xs">
    Downloads, emails, and edits for this receipt
  </p>
  {activityHistory.length === 0 ? (
    <p className="text-muted text-sm">No activity yet</p>
  ) : (
    activityHistory.map((entry) => <HistoryEntry key={entry.id} {...entry} />)
  )}
</div>
```

Log a `{ action: 'PDF_DOWNLOADED', timestamp }` entry when the user clicks Download PDF Receipt.

---

### 8. Payments tab: Rename "View" button to "View Receipt"

**File:** `PaymentHistory.jsx`

**Problem:** "View" is the most generic possible label. The destination is a full receipt page — that context should be in the label.

**Fix:**

```jsx
// ❌ Before
<Button variant="outline" onClick={() => navigate(`/payment/${payment.id}`)}>
  View
</Button>

// ✅ After
<Button variant="outline" onClick={() => navigate(`/payment/${payment.id}`)}>
  View Receipt
</Button>
```

---

### 9. Payments tab: Add tenant filter

**File:** `PaymentHistory.jsx`

**Problem:** No way to filter payment history by tenant. Critical gap for properties with 10+ tenants.

**Fix — Add tenant select to the filter row:**

```jsx
// Add to filter bar alongside Start Date / End Date / Payment Method
<Select value={selectedTenant} onValueChange={setSelectedTenant}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="All Tenants" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Tenants</SelectItem>
    {tenants.map((t) => (
      <SelectItem key={t._id} value={t._id}>
        {t.fullName}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Pass `tenantId` as a query param to the payments API when a tenant is selected.

---

### 10. Payments tab: Add summary KPI strip

**File:** `PaymentHistory.jsx`

**Problem:** Switching from Rent tab (which has Collected / Outstanding / Total Due) to Payments tab strips all financial context. The user loses their bearings.

**Fix — Add a simple KPI row above the filter bar:**

```jsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <KpiCard
    label="Total Collected"
    value={formatCurrency(summary.totalCollected)}
  />
  <KpiCard label="Payments Count" value={summary.count} />
  <KpiCard label="Date Range" value={summary.dateRange || "All time"} />
</div>
```

Derive `summary` from the filtered payment list (or a separate `/payments/summary` API endpoint). Update dynamically when filters change.

---

## P2 — Next Sprint

### 11. Payments tab: Add billing period column

**File:** `PaymentHistory.jsx`

**Problem:** Payment Date ≠ Billing Period. A late payer making a Poush payment in Falgun creates an ambiguous record without this column.

**Fix — Add column to table:**

```jsx
// Table header
<TableHead>For Period</TableHead>

// Table cell
<TableCell>
  {payment.billingPeriod} {payment.billingYear}
</TableCell>
```

---

### 12. Payments tab: Clarify "Copy Payment Link" on paid receipts

**File:** `PaymentDetail.jsx`

**Problem:** "Copy Payment Link" implies sending a payment request — but this is already a paid record. The label is misleading.

**Fix:**

```jsx
// Rename to reflect actual action (sharing the receipt URL)
// ❌ Before
Copy Payment Link

// ✅ After
Copy Receipt Link
```

If the intent is to send a payment request to a tenant, disable or hide this action on records with status `paid`.

---

### 13. Payments tab: Sortable columns

**File:** `PaymentHistory.jsx`

**Problem:** No column sort. Amount, Payment Date, and Tenant are natural sort axes.

**Fix:**

```jsx
const [sortKey, setSortKey] = useState("paymentDate");
const [sortDir, setSortDir] = useState("desc");

const sorted = [...payments].sort((a, b) => {
  const dir = sortDir === "asc" ? 1 : -1;
  if (sortKey === "amount") return (a.amount - b.amount) * dir;
  if (sortKey === "paymentDate")
    return (new Date(a.paymentDate) - new Date(b.paymentDate)) * dir;
  if (sortKey === "tenant")
    return a.tenantName.localeCompare(b.tenantName) * dir;
  return 0;
});

// In TableHead:
<TableHead
  className="cursor-pointer select-none"
  onClick={() => {
    setSortKey("amount");
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }}
>
  Amount {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
</TableHead>;
```

---

### 14. Payments tab: Add CSV export

**File:** `PaymentHistory.jsx`

**Problem:** Landlords need to export payment history for accounting and tax. No export exists.

**Fix:**

```jsx
const exportCSV = () => {
  const headers = [
    "Tenant",
    "Payment Date",
    "For Period",
    "Amount",
    "Method",
    "Status",
  ];
  const rows = filteredPayments.map((p) => [
    p.tenantName,
    p.paymentDate,
    `${p.billingPeriod} ${p.billingYear}`,
    p.amount,
    p.paymentMethod,
    p.status,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-export-${Date.now()}.csv`;
  a.click();
};

// Add button to filter bar
<Button variant="outline" onClick={exportCSV}>
  Export CSV
</Button>;
```

---

### 15. Rent tab: Add "View Receipt" shortcut on Paid rows

**File:** `RentPayment.jsx`

**Problem:** A landlord must switch tabs and find the record just to open a receipt for a paid tenant. Paid rows in the Rent tab should link directly.

**Fix — In the Actions column for paid rows:**

```jsx
{
  rent.status === "paid" ? (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/payment/${rent.latestPaymentId}`)}
      >
        View Receipt
      </Button>
      <StatusBadge status="paid" />
    </div>
  ) : (
    <Button onClick={() => openPaymentDialog(rent)}>Record Payment</Button>
  );
}
```

Ensure `latestPaymentId` is included in the rent record API response.

---

## P3 — Backlog

### 16. Receipt: Add print option

**File:** `PaymentDetail.jsx`

```jsx
// Add to Quick Actions panel
<Button variant="outline" onClick={() => window.print()}>
  🖨️ Print Receipt
</Button>

// Add print-specific CSS
@media print {
  .quick-actions-panel { display: none; }
  .breadcrumb { display: none; }
  .receipt-card { box-shadow: none; border: 1px solid #ccc; }
}
```

---

### 17. Payments tab: Add pagination

**File:** `PaymentHistory.jsx`

```jsx
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);
const paginated = filteredPayments.slice(
  (page - 1) * PAGE_SIZE,
  page * PAGE_SIZE,
);
const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);

// Below table
{
  totalPages > 1 && (
    <div className="flex justify-between items-center mt-4 text-sm text-muted">
      <span>
        Showing {(page - 1) * PAGE_SIZE + 1}–
        {Math.min(page * PAGE_SIZE, filteredPayments.length)} of{" "}
        {filteredPayments.length}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

---

### 18. Payments tab: Empty state for filtered results

**File:** `PaymentHistory.jsx`

```jsx
{
  filteredPayments.length === 0 && (
    <div className="text-center py-16 text-muted">
      <p className="text-lg font-medium">No payments found</p>
      <p className="text-sm mt-1">Try adjusting your filters or date range</p>
      <Button variant="ghost" className="mt-4" onClick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  );
}
```

---

## Quick Reference: Fix Priority Order

| #   | Fix                                              | File                 | Priority |
| --- | ------------------------------------------------ | -------------------- | -------- |
| 1   | Fix raw label `BankName_Type` → `Bank`           | `PaymentDetail.jsx`  | 🔴 P0    |
| 2   | Fix lowercase property name on receipt           | `PaymentDetail.jsx`  | 🔴 P0    |
| 3   | Handle empty phone number field                  | `PaymentDetail.jsx`  | 🔴 P0    |
| 4   | Fix amount clipping at bottom                    | `PaymentDetail.jsx`  | 🔴 P0    |
| 5   | Add billing period to receipt                    | `PaymentDetail.jsx`  | 🟠 P1    |
| 6   | Add breadcrumb / back navigation                 | `PaymentDetail.jsx`  | 🟠 P1    |
| 7   | Fix or hide empty History panel                  | `PaymentDetail.jsx`  | 🟠 P1    |
| 8   | Rename "View" → "View Receipt"                   | `PaymentHistory.jsx` | 🟠 P1    |
| 9   | Add tenant filter                                | `PaymentHistory.jsx` | 🟠 P1    |
| 10  | Add KPI summary strip                            | `PaymentHistory.jsx` | 🟠 P1    |
| 11  | Add billing period column                        | `PaymentHistory.jsx` | 🟡 P2    |
| 12  | Rename "Copy Payment Link" → "Copy Receipt Link" | `PaymentDetail.jsx`  | 🟡 P2    |
| 13  | Sortable table columns                           | `PaymentHistory.jsx` | 🟡 P2    |
| 14  | CSV export button                                | `PaymentHistory.jsx` | 🟡 P2    |
| 15  | View Receipt shortcut on Rent tab paid rows      | `RentPayment.jsx`    | 🟡 P2    |
| 16  | Print receipt option                             | `PaymentDetail.jsx`  | ⚪ P3    |
| 17  | Pagination                                       | `PaymentHistory.jsx` | ⚪ P3    |
| 18  | Empty state for filtered results                 | `PaymentHistory.jsx` | ⚪ P3    |
