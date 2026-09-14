import { extractText } from "unpdf";

export const extractPdfText = async (pdfBuffer: ArrayBuffer) => {
  const parsed = await extractText(pdfBuffer, { mergePages: true });
  const text = Array.isArray(parsed.text) ? parsed.text.join("\n") : parsed.text;

  return text.replace(/\s+/g, " ").trim();
};
