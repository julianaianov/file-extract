// Small self-authored PDF fixtures: no third-party documents in the repository.
function makePdf(options = {}) {
  const text = options.text || "FILE EXTRACT PDF TEST 12345";
  const content =
    "BT /F1 18 Tf 50 750 Td (" + text.replace(/[()\\]/g, "\\$&") + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " +
      Buffer.byteLength(content) +
      " >>\nstream\n" +
      content +
      "\nendstream",
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += i + 1 + " 0 obj\n" + body + "\nendobj\n";
  });
  const start = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i < 6; i++)
    pdf +=
      String(
        options.damagedXref && i === 1 ? offsets[i] + 3 : offsets[i],
      ).padStart(10, "0") + " 00000 n \n";
  pdf +=
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + start + "\n%%EOF\n";
  return Buffer.from(pdf);
}
module.exports = { makePdf };
