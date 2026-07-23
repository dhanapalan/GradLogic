/**
 * Invoice PDF Generation
 *
 * Generates professional invoice PDFs for student billing.
 * Uses pdfkit (lightweight, no external dependencies).
 */

import PDFDocument from "pdfkit";
import { query, queryOne } from "../config/database.js";
import { logger } from "../config/logger.js";

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  college: {
    name: string;
    email: string;
    gstNumber?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

/**
 * Generate invoice PDF as Buffer
 */
export function generateInvoicePdf(data: InvoiceData): PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  // Header
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("GradLogic Invoice", 50, 50);

  // Invoice details
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice #: ${data.invoiceNumber}`, 50, 90)
    .text(`Date: ${data.date.toLocaleDateString("en-IN")}`, 50, 105)
    .text(`Due Date: ${data.dueDate.toLocaleDateString("en-IN")}`, 50, 120);

  // Bill To
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("BILL TO:", 50, 160);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(data.college.name, 50, 180)
    .text(data.college.email, 50, 195);

  if (data.college.gstNumber) {
    doc.text(`GST: ${data.college.gstNumber}`, 50, 210);
  }

  // Table header
  const tableTop = data.college.gstNumber ? 250 : 235;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Description", 50, tableTop)
    .text("Qty", 350, tableTop, { width: 50, align: "right" })
    .text("Unit Price", 400, tableTop, { width: 80, align: "right" })
    .text("Amount", 480, tableTop, { width: 80, align: "right" });

  // Draw line
  doc
    .moveTo(50, tableTop + 15)
    .lineTo(560, tableTop + 15)
    .stroke();

  // Table rows
  let y = tableTop + 30;
  doc.font("Helvetica").fontSize(10);

  for (const item of data.items) {
    doc.text(item.description, 50, y);
    doc.text(item.quantity.toString(), 350, y, { width: 50, align: "right" });
    doc.text(`${data.currency} ${item.unitPrice.toFixed(2)}`, 400, y, {
      width: 80,
      align: "right",
    });
    doc.text(`${data.currency} ${item.amount.toFixed(2)}`, 480, y, {
      width: 80,
      align: "right",
    });
    y += 20;
  }

  // Draw line
  doc
    .moveTo(50, y)
    .lineTo(560, y)
    .stroke();

  y += 10;

  // Totals
  doc.font("Helvetica").fontSize(10);
  doc.text("Subtotal:", 400, y, { width: 80, align: "right" });
  doc.text(`${data.currency} ${data.subtotal.toFixed(2)}`, 480, y, {
    width: 80,
    align: "right",
  });

  y += 20;
  if (data.tax > 0) {
    doc.text("Tax (18% GST):", 400, y, { width: 80, align: "right" });
    doc.text(`${data.currency} ${data.tax.toFixed(2)}`, 480, y, {
      width: 80,
      align: "right",
    });
    y += 20;
  }

  // Total
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("TOTAL:", 400, y, { width: 80, align: "right" })
    .text(`${data.currency} ${data.total.toFixed(2)}`, 480, y, {
      width: 80,
      align: "right",
    });

  // Footer
  doc
    .fontSize(8)
    .font("Helvetica")
    .text(
      "Thank you for using GradLogic. Payment instructions will be sent separately.",
      50,
      750,
      { align: "center" },
    );

  return doc;
}

/**
 * Load invoice from database and generate PDF
 */
export async function generateInvoiceFromDb(
  invoiceId: string,
  collegeId: string,
): Promise<PDFDocument | null> {
  try {
    const invoice = await queryOne(
      `SELECT i.*, s.plan_id, sp.name as plan_name, sp.price_per_month
       FROM invoices i
       LEFT JOIN subscriptions s ON s.id = i.subscription_id
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE i.id = $1 AND i.college_id = $2`,
      [invoiceId, collegeId],
    );

    if (!invoice) {
      logger.warn("Invoice not found for PDF generation", { invoiceId });
      return null;
    }

    const college = await queryOne(
      `SELECT name, contact_email, (
         SELECT gst_number FROM billing_contacts
         WHERE college_id = $1 AND is_primary = TRUE
         LIMIT 1
       ) as gst_number
       FROM colleges WHERE id = $1`,
      [collegeId],
    );

    if (!college) {
      logger.warn("College not found for invoice PDF", { collegeId });
      return null;
    }

    const data: InvoiceData = {
      invoiceNumber: invoice.invoice_number,
      date: new Date(invoice.issued_date),
      dueDate: new Date(invoice.due_date),
      college: {
        name: college.name,
        email: college.contact_email,
        gstNumber: college.gst_number,
      },
      items: [
        {
          description: `${college.name} - ${invoice.plan_name || "Monthly Subscription"}`,
          quantity: 1,
          unitPrice: invoice.amount_due,
          amount: invoice.amount_due,
        },
      ],
      subtotal: invoice.amount_due,
      tax: 0, // Tax already included in amount_due if applicable
      total: invoice.total,
      currency: "₹",
    };

    return generateInvoicePdf(data);
  } catch (err) {
    logger.error("Failed to generate invoice PDF from DB", { error: err });
    return null;
  }
}
