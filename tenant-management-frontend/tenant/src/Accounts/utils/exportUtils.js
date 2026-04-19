/**
 * exportUtils.js
 *
 * Real-world accounting exports for tenant owners:
 *   - exportLedgerCSV   → downloads all ledger entries as a .csv (accountant-ready)
 *   - exportLedgerPDF   → downloads a formatted general-ledger report as .pdf
 *   - exportBalanceSheetPDF → downloads a standard balance-sheet report as .pdf
 *
 * CSV uses the native Blob API — no extra dependency.
 * PDF uses jspdf (already in package.json).
 */

import { jsPDF } from "jspdf";
import { toBSDate } from "./nepaliCalendar";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtMoney(paisa, isDirect = false) {
    // isDirect = amount is already in rupees (ledger entries), not paisa
    const val = isDirect ? paisa : paisa / 100;
    return val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function sanitizeFilename(label) {
    return label.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}

function todayLabel() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── PDF drawing helpers ──────────────────────────────────────────────────────

const PAGE_W   = 210;   // A4 mm
const PAGE_H   = 297;
const MARGIN_L = 14;
const MARGIN_R = 14;
const BODY_W   = PAGE_W - MARGIN_L - MARGIN_R;

function addPage(doc) {
    doc.addPage();
    return MARGIN_L;
}

function drawHR(doc, y, color = [220, 220, 220]) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
}

function drawHeader(doc, title, subtitle, period, entityName) {
    // Teal accent stripe at top
    doc.setFillColor(20, 130, 130);
    doc.rect(0, 0, PAGE_W, 14, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, MARGIN_L, 9);

    if (entityName) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(entityName, PAGE_W - MARGIN_R, 9, { align: "right" });
    }

    let y = 20;
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(subtitle, MARGIN_L, y);

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${period}`, MARGIN_L, y);
    doc.text(`Generated: ${todayLabel()}`, PAGE_W - MARGIN_R, y, { align: "right" });

    y += 3;
    drawHR(doc, y, [20, 130, 130]);
    return y + 5;
}

function addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        drawHR(doc, PAGE_H - 10, [200, 200, 200]);
        doc.text(
            `Page ${i} of ${pageCount}`,
            PAGE_W / 2,
            PAGE_H - 5,
            { align: "center" },
        );
    }
}

// ─── 1. LEDGER CSV ───────────────────────────────────────────────────────────

/**
 * Exports ALL ledger entries (not just the current page) to a .csv file.
 * Columns: Date (BS), Description, Account, Debit (₹), Credit (₹), Running Balance (₹)
 *
 * @param {Array}  entries     - full ledger entry array from API
 * @param {string} filterLabel - human-readable period label (e.g. "FY 2081/82")
 * @param {Object} totals      - { totalRevenue, totalExpenses, netCashFlow }
 * @param {string} entityName  - optional entity/property name
 */
export function exportLedgerCSV(entries, filterLabel, totals = {}, entityName = "") {
    const rows = [
        // File metadata rows (useful for accountants)
        [`General Ledger Report`],
        [`Period: ${filterLabel}`],
        entityName ? [`Entity: ${entityName}`] : [],
        [`Generated: ${todayLabel()}`],
        [],
        // Column header
        ["Date (BS)", "Description", "Account", "Debit (Rs)", "Credit (Rs)", "Running Balance (Rs)"],
    ].filter(r => r.length > 0);

    for (const e of entries) {
        rows.push([
            toBSDate(e.date),
            e.description || e.account?.name || "",
            e.account?.name || "",
            e.debit ? e.debit.toFixed(2) : "",
            e.credit ? e.credit.toFixed(2) : "",
            e.runningBalance !== undefined ? e.runningBalance.toFixed(2) : "",
        ]);
    }

    // Totals footer
    rows.push([]);
    rows.push(["", "TOTAL CREDITS (Revenue)", "", "", (totals.totalRevenue ?? 0).toFixed(2), ""]);
    rows.push(["", "TOTAL DEBITS (Expenses)", "", (totals.totalExpenses ?? 0).toFixed(2), "", ""]);
    rows.push(["", "NET CASH FLOW", "", "", "", (totals.netCashFlow ?? 0).toFixed(2)]);

    const csv = rows
        .map(row =>
            row.map(cell => {
                const str = String(cell ?? "");
                // Wrap in quotes if contains comma, newline, or quote
                return str.includes(",") || str.includes('"') || str.includes("\n")
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(","),
        )
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `Ledger_${sanitizeFilename(filterLabel)}_${todayLabel()}.csv`);
}

// ─── 2. LEDGER PDF ───────────────────────────────────────────────────────────

/**
 * Exports a professional General Ledger report as PDF.
 *
 * @param {Array}  entries
 * @param {Object} totals      - { totalRevenue, totalExpenses, netCashFlow }
 * @param {string} filterLabel
 * @param {string} entityName
 */
export function exportLedgerPDF(entries, totals = {}, filterLabel, entityName = "") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let y = drawHeader(doc, "General Ledger Report", "Transaction Ledger", filterLabel, entityName);

    // Column layout (x positions, widths)
    const cols = [
        { label: "Date (BS)",    x: MARGIN_L,      w: 28, align: "left"  },
        { label: "Description",  x: MARGIN_L + 28, w: 72, align: "left"  },
        { label: "Debit (Rs)",   x: MARGIN_L + 100,w: 28, align: "right" },
        { label: "Credit (Rs)",  x: MARGIN_L + 128,w: 28, align: "right" },
        { label: "Balance (Rs)", x: MARGIN_L + 156,w: 26, align: "right" },
    ];

    const ROW_H = 6;
    const COL_H = 7;

    function drawColHeaders(yy) {
        // Light grey header bar
        doc.setFillColor(245, 245, 245);
        doc.rect(MARGIN_L, yy - 5, BODY_W, COL_H, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);

        for (const col of cols) {
            const tx = col.align === "right" ? col.x + col.w : col.x;
            doc.text(col.label, tx, yy, { align: col.align });
        }
        return yy + 3;
    }

    function checkPageBreak(yy, needed = ROW_H + 2) {
        if (yy + needed > PAGE_H - 18) {
            doc.addPage();
            yy = drawHeader(doc, "General Ledger Report (cont.)", "Transaction Ledger", filterLabel, entityName);
            yy = drawColHeaders(yy);
        }
        return yy;
    }

    y = drawColHeaders(y);

    let rowIndex = 0;
    for (const entry of entries) {
        y = checkPageBreak(y);

        // Zebra stripe
        if (rowIndex % 2 === 0) {
            doc.setFillColor(252, 252, 252);
            doc.rect(MARGIN_L, y - 4, BODY_W, ROW_H, "F");
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(50, 50, 50);

        // Date
        doc.text(toBSDate(entry.date), cols[0].x, y);

        // Description (truncate if too long)
        const desc = entry.description || entry.account?.name || "—";
        const maxDescChars = 52;
        doc.text(
            desc.length > maxDescChars ? desc.slice(0, maxDescChars - 1) + "…" : desc,
            cols[1].x, y,
        );

        // Debit — red tint
        if (entry.debit) {
            doc.setTextColor(180, 60, 60);
            doc.text(fmtMoney(entry.debit, true), cols[2].x + cols[2].w, y, { align: "right" });
            doc.setTextColor(50, 50, 50);
        } else {
            doc.text("—", cols[2].x + cols[2].w, y, { align: "right" });
        }

        // Credit — green tint
        if (entry.credit) {
            doc.setTextColor(30, 130, 80);
            doc.text(fmtMoney(entry.credit, true), cols[3].x + cols[3].w, y, { align: "right" });
            doc.setTextColor(50, 50, 50);
        } else {
            doc.text("—", cols[3].x + cols[3].w, y, { align: "right" });
        }

        // Running balance
        const bal = entry.runningBalance;
        if (bal !== undefined) {
            doc.setFont("helvetica", "bold");
            doc.text(fmtMoney(bal, true), cols[4].x + cols[4].w, y, { align: "right" });
            doc.setFont("helvetica", "normal");
        } else {
            doc.text("—", cols[4].x + cols[4].w, y, { align: "right" });
        }

        y += ROW_H;
        rowIndex++;
    }

    // ── Totals footer ──────────────────────────────────────────────────────────
    y = checkPageBreak(y, 24);
    y += 3;
    drawHR(doc, y, [80, 160, 140]);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text("Summary", MARGIN_L, y);
    y += 5;

    const summaryRows = [
        { label: "Total Credits (Revenue)",  value: totals.totalRevenue  ?? 0, color: [30, 130, 80]  },
        { label: "Total Debits (Expenses)",  value: totals.totalExpenses ?? 0, color: [180, 60, 60]  },
        { label: "Net Cash Flow",            value: totals.netCashFlow   ?? 0, color: [20, 130, 130] },
    ];

    for (const row of summaryRows) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(row.label, MARGIN_L + 4, y);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...row.color);
        doc.text(
            `Rs ${fmtMoney(row.value, true)}`,
            PAGE_W - MARGIN_R,
            y,
            { align: "right" },
        );
        doc.setTextColor(50, 50, 50);
        y += 5.5;
    }

    addFooter(doc);
    doc.save(`Ledger_${sanitizeFilename(filterLabel)}_${todayLabel()}.pdf`);
}

// ─── 3. BALANCE SHEET PDF ─────────────────────────────────────────────────────

/**
 * Exports a professional Balance Sheet as PDF.
 * Format: Assets on left, Liabilities + Equity on right (two-column).
 *
 * @param {Object} balanceSheet - the full balanceSheet object from useBalanceSheet
 * @param {string} filterLabel
 * @param {string} entityName
 */
export function exportBalanceSheetPDF(balanceSheet, filterLabel, entityName = "") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let y = drawHeader(doc, "Balance Sheet", "Statement of Financial Position", filterLabel, entityName);

    const {
        assetAccounts = [],
        liabilityAccounts = [],
        equityAccounts = [],
        retainedEarnings,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
        isBalanced,
    } = balanceSheet;

    // ── Balance check banner ──────────────────────────────────────────────────
    doc.setFillColor(isBalanced ? 220 : 255, isBalanced ? 245 : 220, isBalanced ? 230 : 220);
    doc.rect(MARGIN_L, y, BODY_W, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(isBalanced ? 30 : 180, isBalanced ? 130 : 60, isBalanced ? 80 : 60);
    doc.text(
        isBalanced ? "✓  Balance Sheet is balanced  (Assets = Liabilities + Equity)" : "⚠  Balance Sheet is OUT OF BALANCE",
        MARGIN_L + 4,
        y + 5.5,
    );
    y += 13;

    // ── Column layout: two half-page columns ──────────────────────────────────
    const COL_MID  = PAGE_W / 2;
    const COL_L_W  = COL_MID - MARGIN_L - 4;
    const COL_R_X  = COL_MID + 4;
    const COL_R_W  = PAGE_W - MARGIN_R - COL_R_X;

    const ROW_H = 5.5;

    function drawSectionTitle(xx, yy, label, color) {
        doc.setFillColor(...color, 20);
        doc.rect(xx, yy - 4, xx === MARGIN_L ? COL_L_W : COL_R_W, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...color);
        doc.text(label.toUpperCase(), xx + 2, yy);
        return yy + 4;
    }

    function drawAccountRow(xx, yy, code, name, amountPaisa, indent = 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(code, xx + indent, yy);

        // Truncate name
        const maxW = (xx === MARGIN_L ? COL_L_W : COL_R_W) - 30 - indent;
        const nameStr = name.length > 35 ? name.slice(0, 34) + "…" : name;
        doc.setTextColor(40, 40, 40);
        doc.text(nameStr, xx + indent + 12, yy);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const endX = xx === MARGIN_L ? MARGIN_L + COL_L_W : COL_R_X + COL_R_W;
        doc.text(fmtMoney(amountPaisa), endX, yy, { align: "right" });
        return yy + ROW_H;
    }

    function drawSectionTotal(xx, yy, label, amountPaisa, color) {
        drawHR(doc, yy - 1, [200, 200, 200]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);
        doc.text(label, xx + 2, yy + 3);

        doc.setTextColor(...color);
        const endX = xx === MARGIN_L ? MARGIN_L + COL_L_W : COL_R_X + COL_R_W;
        doc.text(`Rs ${fmtMoney(amountPaisa)}`, endX, yy + 3, { align: "right" });
        return yy + 7;
    }

    // ── LEFT: Assets ──────────────────────────────────────────────────────────
    let yL = y;
    yL = drawSectionTitle(MARGIN_L, yL, "Assets", [20, 100, 180]);
    yL += 2;

    for (const acc of assetAccounts) {
        yL = drawAccountRow(MARGIN_L, yL, acc.code, acc.name, acc.balance?.paisa ?? 0);
    }
    yL += 2;
    yL = drawSectionTotal(MARGIN_L, yL, "Total Assets", totalAssets?.paisa ?? 0, [20, 100, 180]);

    // ── RIGHT: Liabilities ────────────────────────────────────────────────────
    let yR = y;
    yR = drawSectionTitle(COL_R_X, yR, "Liabilities", [180, 60, 60]);
    yR += 2;

    for (const acc of liabilityAccounts) {
        yR = drawAccountRow(COL_R_X, yR, acc.code, acc.name, acc.balance?.paisa ?? 0);
    }
    yR += 2;
    yR = drawSectionTotal(COL_R_X, yR, "Total Liabilities", totalLiabilities?.paisa ?? 0, [180, 60, 60]);

    // ── RIGHT (continued): Equity ─────────────────────────────────────────────
    yR += 4;
    yR = drawSectionTitle(COL_R_X, yR, "Equity", [30, 130, 80]);
    yR += 2;

    for (const acc of equityAccounts) {
        yR = drawAccountRow(COL_R_X, yR, acc.code, acc.name, acc.balance?.paisa ?? 0);
    }
    if (retainedEarnings) {
        yR = drawAccountRow(COL_R_X, yR, retainedEarnings.code, retainedEarnings.name, retainedEarnings.balance?.paisa ?? 0, 2);
    }
    yR += 2;
    yR = drawSectionTotal(COL_R_X, yR, "Total Equity", totalEquity?.paisa ?? 0, [30, 130, 80]);

    // ── Bottom totals comparison ──────────────────────────────────────────────
    const finalY = Math.max(yL, yR) + 8;
    drawHR(doc, finalY, [20, 130, 130]);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 130, 130);
    doc.text("Total Assets", MARGIN_L + 2, finalY + 6);
    doc.text(`Rs ${fmtMoney(totalAssets?.paisa ?? 0)}`, COL_MID - 4, finalY + 6, { align: "right" });

    doc.text("Total Liabilities + Equity", COL_R_X, finalY + 6);
    doc.text(`Rs ${fmtMoney(totalLiabilitiesAndEquity?.paisa ?? 0)}`, PAGE_W - MARGIN_R, finalY + 6, { align: "right" });

    addFooter(doc);
    doc.save(`BalanceSheet_${sanitizeFilename(filterLabel)}_${todayLabel()}.pdf`);
}
