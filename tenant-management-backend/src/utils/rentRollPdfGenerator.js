import PDFDocument from "pdfkit";

/**
 * generateRentRollPDF
 *
 * Generates a rent roll PDF buffer for a given period.
 *
 * @param {Array}  rents        - Rent documents (populated: tenant.name, block.name)
 * @param {Object} period       - { nepaliMonth, nepaliYear }
 * @param {Object} issuer       - { name, address }
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
      const totalPaid = rents.reduce((s, r) => s + (r.paidAmountPaisa ?? 0), 0);
      const totalTds = rents.reduce((s, r) => s + (r.tdsAmountPaisa ?? 0), 0);
      const totalCam = rents.reduce((s, r) => s + (r.camAmountPaisa ?? r.camPaisa ?? 0), 0);
      const totalOutstanding = totalGross - totalPaid;

      doc.fontSize(10).font("Helvetica-Bold").text("Summary:", L);
      doc.font("Helvetica").fontSize(9)
        .text(`Total Gross Rent: Rs. ${(totalGross / 100).toLocaleString()}   |   CAM: Rs. ${(totalCam / 100).toLocaleString()}   |   TDS: Rs. ${(totalTds / 100).toLocaleString()}   |   Collected: Rs. ${(totalPaid / 100).toLocaleString()}   |   Outstanding: Rs. ${(totalOutstanding / 100).toLocaleString()}`, L, doc.y);
      doc.moveDown(0.6);

      // ── TABLE ─────────────────────────────────────────────────────────────────
      const colX = {
        no:       L,
        tenant:   L + 25,
        block:    L + 180,
        month:    L + 290,
        gross:    L + 370,
        cam:      L + 450,
        tds:      L + 530,
        paid:     L + 610,
        status:   L + 690,
        due:      L + 740,
      };

      const tblTop = doc.y;
      const rowH = 16;

      // Header row
      doc.rect(L, tblTop, W, rowH).fillAndStroke("#f0f0f0", "#cccccc");
      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold")
        .text("#", colX.no + 2, tblTop + 4)
        .text("Tenant", colX.tenant + 2, tblTop + 4)
        .text("Block / Unit", colX.block + 2, tblTop + 4)
        .text("Period", colX.month + 2, tblTop + 4)
        .text("Gross Rent", colX.gross + 2, tblTop + 4)
        .text("CAM", colX.cam + 2, tblTop + 4)
        .text("TDS", colX.tds + 2, tblTop + 4)
        .text("Paid", colX.paid + 2, tblTop + 4)
        .text("Status", colX.status + 2, tblTop + 4);

      let rowY = tblTop + rowH;

      rents.forEach((rent, i) => {
        const bg = i % 2 === 0 ? "#ffffff" : "#f9f9f9";
        doc.rect(L, rowY, W, rowH).fillAndStroke(bg, "#e0e0e0");
        doc.fillColor("#000000").fontSize(7.5).font("Helvetica")
          .text(String(i + 1), colX.no + 2, rowY + 4, { width: 22, ellipsis: true })
          .text(rent.tenant?.name || "—", colX.tenant + 2, rowY + 4, { width: 100, ellipsis: true })
          .text(rent.block?.name || rent.innerBlock?.name || "—", colX.block + 2, rowY + 4, { width: 100, ellipsis: true })
          .text(`${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`, colX.month + 2, rowY + 4)
          .text(((rent.grossRentAmountPaisa ?? 0) / 100).toLocaleString(), colX.gross + 2, rowY + 4)
          .text(((rent.camAmountPaisa ?? rent.camPaisa ?? 0) / 100).toLocaleString(), colX.cam + 2, rowY + 4)
          .text(((rent.tdsAmountPaisa ?? 0) / 100).toLocaleString(), colX.tds + 2, rowY + 4)
          .text(((rent.paidAmountPaisa ?? 0) / 100).toLocaleString(), colX.paid + 2, rowY + 4)
          .text(rent.status || "—", colX.status + 2, rowY + 4);

        rowY += rowH;

        // Page break if near bottom
        if (rowY > 540) {
          doc.addPage({ layout: "landscape" });
          rowY = 40;
        }
      });

      // Footer totals row
      doc.rect(L, rowY, W, rowH).fillAndStroke("#e8f0fe", "#aaaaaa");
      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold")
        .text("TOTALS", colX.tenant + 2, rowY + 4)
        .text((totalGross / 100).toLocaleString(), colX.gross + 2, rowY + 4)
        .text((totalCam / 100).toLocaleString(), colX.cam + 2, rowY + 4)
        .text((totalTds / 100).toLocaleString(), colX.tds + 2, rowY + 4)
        .text((totalPaid / 100).toLocaleString(), colX.paid + 2, rowY + 4);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
