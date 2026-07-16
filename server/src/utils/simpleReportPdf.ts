/**
 * Minimal multi-line portrait PDF for analytics reports (no external PDF deps).
 */

function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const code = ch.charCodeAt(0);
      if (code < 256) return String.fromCharCode(code);
      return "";
    });
}

function line(x: number, y: number, size: number, text: string): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`;
}

export interface SimpleReportPdfInput {
  title: string;
  subtitle?: string;
  lines: string[];
}

/** Portrait A4 ~595×842 points. */
export function buildSimpleReportPdf(input: SimpleReportPdfInput): Buffer {
  const w = 595;
  const h = 842;
  const margin = 48;
  const maxLines = 48;
  const body = input.lines.slice(0, maxLines);

  const ops: string[] = [
    "1 w 0.15 0.2 0.3 RG",
    `${margin} ${h - margin} ${w - margin * 2} ${-(h - margin * 2)} re S`,
    line(margin + 16, h - 64, 16, input.title.slice(0, 70)),
  ];
  if (input.subtitle) {
    ops.push(line(margin + 16, h - 86, 11, input.subtitle.slice(0, 80)));
  }

  let y = h - 120;
  for (const raw of body) {
    if (y < margin + 40) break;
    const text = raw.length > 90 ? `${raw.slice(0, 87)}...` : raw;
    const size = text.startsWith("—") ? 11 : 10;
    ops.push(line(margin + 16, y, size, text || " "));
    y -= text.startsWith("—") ? 18 : 14;
  }

  ops.push(line(margin + 16, margin + 20, 8, "GradLogic · Assessment Analytics"));

  const stream = ops.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n`
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
