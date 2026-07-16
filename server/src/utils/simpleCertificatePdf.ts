/**
 * Minimal single-page landscape PDF (no external PDF deps).
 * TalentSecure certificates — Helvetica text only.
 */

function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      // Drop non-Latin1 for core Helvetica; keep ASCII-friendly certificate text
      const code = ch.charCodeAt(0);
      if (code < 256) return String.fromCharCode(code);
      return "";
    });
}

function line(x: number, y: number, size: number, text: string): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`;
}

export interface CertificatePdfInput {
  platformName?: string;
  studentName: string;
  achievementTitle: string;
  kindLabel: string;
  issuedAtLabel: string;
  verificationCode: string;
}

/** Landscape A4-ish page ~842×595 points. */
export function buildSimpleCertificatePdf(input: CertificatePdfInput): Buffer {
  const platform = input.platformName || "TalentSecure AI";
  const w = 842;
  const h = 595;

  const content = [
    // Border
    "2 w 0.12 0.18 0.35 RG",
    `40 40 ${w - 80} ${h - 80} re S`,
    "0.5 w 0.55 0.6 0.7 RG",
    `50 50 ${w - 100} ${h - 100} re S`,
    // Accent top bar
    "0.07 0.18 0.42 rg",
    `50 ${h - 70} ${w - 100} 8 re f`,
    // Text
    "0.07 0.12 0.22 rg",
    line(w / 2 - 90, h - 110, 14, platform),
    "0.35 0.4 0.5 rg",
    line(w / 2 - 70, h - 145, 11, "Certificate of Completion"),
    "0.07 0.12 0.22 rg",
    line(w / 2 - 55, h - 200, 10, "This certifies that"),
    line(w / 2 - Math.min(200, input.studentName.length * 5), h - 250, 22, input.studentName),
    "0.35 0.4 0.5 rg",
    line(w / 2 - 80, h - 290, 10, "has successfully completed"),
    "0.07 0.12 0.22 rg",
    line(
      w / 2 - Math.min(220, input.achievementTitle.length * 4),
      h - 335,
      16,
      input.achievementTitle
    ),
    "0.2 0.45 0.55 rg",
    line(w / 2 - Math.min(120, input.kindLabel.length * 3.5), h - 375, 11, input.kindLabel),
    "0.35 0.4 0.5 rg",
    line(80, 95, 9, `Issued: ${input.issuedAtLabel}`),
    line(80, 78, 8, `Verification: ${input.verificationCode}`),
    line(w - 220, 90, 9, "TalentSecure AI Assessment Hub"),
  ].join("\n");

  const contentBuf = Buffer.from(content, "utf8");

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n`
  );
  objects.push(
    `4 0 obj<< /Length ${contentBuf.length} >>stream\n${content}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
