// Configure the bundled worker before importing the PDF engine (Node/Vercel).
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getData());

export interface PdfTextResult {
  text: string | null;
  warning?: string;
  status: "completed" | "empty" | "error";
}
export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  // PDF.js transfers the typed array to its worker. Copy it so the original
  // remains intact for storage and download.
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    stopAtErrors: false,
    isEvalSupported: false,
  });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    const text = result.text.replace(/\u0000/g, "").trim();
    if (!text)
      return {
        text: null,
        status: "empty",
        warning:
          "PDF sem texto selecionável. O original foi salvo para download; o conteúdo precisa de OCR para ser pesquisado.",
      };
    return { text: text.slice(0, 1000000), status: "completed" };
  } catch (error) {
    const password = error instanceof Error && /password/i.test(error.name);
    return {
      text: null,
      status: "error",
      warning: password
        ? "Este PDF exige senha. O original foi salvo; envie uma cópia desbloqueada para extrair o texto."
        : "Não foi possível extrair o texto deste PDF. O original foi preservado para download.",
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
