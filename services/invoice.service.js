import PDFDocument from "pdfkit";

const formatCurrency = (amountInPaise = 0) => {
  const inr = (Number(amountInPaise || 0) / 100).toFixed(2);
  return `₹${inr}`;
};

const addRow = (doc, label, value) => {
  doc.font("Helvetica-Bold").text(label, { continued: true });
  doc.font("Helvetica").text(` ${value}`);
};

export const generatePayoutInvoice = async ({ payout, educator }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const payoutDate = payout.updatedAt || payout.createdAt || new Date();
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("Payout Invoice", { align: "left" });
      doc.moveDown(0.5);

      doc.fontSize(11).font("Helvetica");
      addRow(doc, "Invoice Date:", new Date(payoutDate).toLocaleDateString());
      addRow(doc, "Invoice #:", payout.payoutCheckId || payout._id?.toString());
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text("Educator");
      doc.fontSize(11).font("Helvetica");
      addRow(doc, "Name:", educator?.fullName || "Educator");
      addRow(doc, "Email:", educator?.email || "N/A");
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text("Payout Details");
      doc.fontSize(11).font("Helvetica");
      addRow(doc, "Reference:", payout.payoutCheckId || "");
      addRow(doc, "Status:", payout.status);
      addRow(doc, "Period:", `${payout.month}/${payout.year}`);
      addRow(doc, "Gross Amount:", formatCurrency(payout.grossAmount));
      addRow(doc, "Commission:", formatCurrency(payout.commissionAmount));
      addRow(doc, "Net Payout:", formatCurrency(payout.amount));
      if (payout.razorpayPayoutId) {
        addRow(doc, "Razorpay Payout ID:", payout.razorpayPayoutId);
      }
      doc.moveDown(1);

      doc.fontSize(10).font("Helvetica").fillColor("#555555");
      doc.text(
        "This invoice was generated automatically after your payout was processed. Please keep it for your records.",
        { align: "left" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
