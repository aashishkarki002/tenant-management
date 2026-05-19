import PDFDocument from "pdfkit";

/**
 * generateRentRollPDF
 *
 * @param {Array}  rents   - Enriched rent docs; each must have:
 *                           camAmountPaisa, electricityAmountPaisa (attached by controller)
 * @param {Object} period  - { nepaliMonth, nepaliYear }
 * @param {Object} issuer  - { name, address }
 * @returns {Promise<Buffer>}
 */
export async function generateRentRollPDF(rents, period, issuer = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const L = 40;
      const R = 800;
      const W = R - L;

      const issuerName = issuer.name || "Sallyan House";
      const issuerAddress = issuer.address || "Kathmandu, Nepal";
      const periodLabel = period.nepaliMonth
        ? `Month ${period.nepaliMonth} / ${period.nepaliYear}`
        : `Year ${period.nepaliYear}`;

      // ── HEADER ────────────────────────────────────────────────────────────────
      doc.fontSize(16).font("Helvetica-Bold").text(issuerName, L, 40, { align: "center", width: W });
      doc.fontSize(10).font("Helvetica").text(issuerAddress, L, doc.y, { align: "center", width: W });
      doc.moveDown(0.4);

      doc.strokeColor("#333333").lineWidth(1.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.4);

      doc.fontSize(13).font("Helvetica-Bold")
        .text(`RENT ROLL REPORT — ${periodLabel}`, L, doc.y, { align: "center", width: W });
      doc.fontSize(9).font("Helvetica")
        .text(`Generated: ${new Date().toLocaleDateString("en-GB")}  |  Total Records: ${rents.length}`, L, doc.y, { align: "center", width: W });

      doc.moveDown(0.6);
      doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      // ── SUMMARY ───────────────────────────────────────────────────────────────
      const totalGross = rents.reduce((s, r) => s + (r.grossRentAmountPaisa ?? 0), 0);
      const totalPaid  = rents.reduce((s, r) => s + (r.paidAmountPaisa ?? 0), 0);
      const totalTds   = rents.reduce((s, r) => s + (r.tdsAmountPaisa ?? 0), 0);
      const totalCam   = rents.reduce((s, r) => s + (r.camAmountPaisa ?? 0), 0);
      const totalElec  = rents.reduce((s, r) => s + (r.electricityAmountPaisa ?? 0), 0);
      const totalOutstanding = totalGross - totalPaid;

      const rs = (paisa) => (paisa / 100).toLocaleString();

      doc.fontSize(10).font("Helvetica-Bold").text("Summary:", L);
      doc.font("Helvetica").fontSize(9)
        .text(
          `Gross Rent: Rs. ${rs(totalGross)}   |   CAM: Rs. ${rs(totalCam)}   |   Electricity: Rs. ${rs(totalElec)}   |   TDS: Rs. ${rs(totalTds)}   |   Collected: Rs. ${rs(totalPaid)}   |   Outstanding: Rs. ${rs(totalOutstanding)}`,
          L, doc.y,
        );
      doc.moveDown(0.6);

      // ── TABLE ─────────────────────────────────────────────────────────────────
      // Landscape A4 usable width: L=40 → R=800 (760px)
      // Columns: #(20) | Tenant(115) | Block(90) | Period(65) | Gross(70) | CAM(65) | Elec(65) | TDS(60) | Paid(65) | Status(65)
      const colX = {
        no:     L,
        tenant: L + 20,
        block:  L + 135,
        month:  L + 225,
        gross:  L + 290,
        cam:    L + 360,
        elec:   L + 425,
        tds:    L + 490,
        paid:   L + 550,
        status: L + 615,
      };
      const colW = {
        no:     18,
        tenant: 113,
        block:  88,
        month:  63,
        gross:  68,
        cam:    63,
        elec:   63,
        tds:    58,
        paid:   63,
        status: 145,
      };

      const tblTop = doc.y;
      const rowH = 16;

      const drawRow = (y, bg, stroke) => {
        doc.rect(L, y, W, rowH).fillAndStroke(bg, stroke);
      };

      const cell = (text, cx, y, w) => {
        doc.text(String(text), cx + 2, y + 4, { width: w - 4, ellipsis: true });
      };

      // Header
      drawRow(tblTop, "#f0f0f0", "#cccccc");
      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
      cell("#",          colX.no,     tblTop, colW.no);
      cell("Tenant",     colX.tenant, tblTop, colW.tenant);
      cell("Block/Unit", colX.block,  tblTop, colW.block);
      cell("Period",     colX.month,  tblTop, colW.month);
      cell("Gross Rent", colX.gross,  tblTop, colW.gross);
      cell("CAM",        colX.cam,    tblTop, colW.cam);
      cell("Electricity",colX.elec,   tblTop, colW.elec);
      cell("TDS",        colX.tds,    tblTop, colW.tds);
      cell("Paid",       colX.paid,   tblTop, colW.paid);
      cell("Status",     colX.status, tblTop, colW.status);

      let rowY = tblTop + rowH;

      rents.forEach((rent, i) => {
        const bg = i % 2 === 0 ? "#ffffff" : "#f9f9f9";
        drawRow(rowY, bg, "#e0e0e0");
        doc.fillColor("#000000").fontSize(7.5).font("Helvetica");
        cell(i + 1,                                                         colX.no,     rowY, colW.no);
        cell(rent.tenant?.name || "—",                                      colX.tenant, rowY, colW.tenant);
        cell(rent.block?.name || rent.innerBlock?.name || "—",              colX.block,  rowY, colW.block);
        cell(`${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2,"0")}`, colX.month, rowY, colW.month);
        cell(rs(rent.grossRentAmountPaisa ?? 0),                            colX.gross,  rowY, colW.gross);
        cell(rs(rent.camAmountPaisa ?? 0),                                  colX.cam,    rowY, colW.cam);
        cell(rs(rent.electricityAmountPaisa ?? 0),                          colX.elec,   rowY, colW.elec);
        cell(rs(rent.tdsAmountPaisa ?? 0),                                  colX.tds,    rowY, colW.tds);
        cell(rs(rent.paidAmountPaisa ?? 0),                                 colX.paid,   rowY, colW.paid);
        cell(rent.status || "—",                                            colX.status, rowY, colW.status);

        rowY += rowH;

        if (rowY > 540) {
          doc.addPage({ layout: "landscape" });
          rowY = 40;
        }
      });

      // Totals row
      drawRow(rowY, "#e8f0fe", "#aaaaaa");
      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
      cell("TOTALS",          colX.tenant, rowY, colW.tenant);
      cell(rs(totalGross),    colX.gross,  rowY, colW.gross);
      cell(rs(totalCam),      colX.cam,    rowY, colW.cam);
      cell(rs(totalElec),     colX.elec,   rowY, colW.elec);
      cell(rs(totalTds),      colX.tds,    rowY, colW.tds);
      cell(rs(totalPaid),     colX.paid,   rowY, colW.paid);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
