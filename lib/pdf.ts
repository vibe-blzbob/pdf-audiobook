/**
 * Document chunk model - 1 chunk = 1 sentence with paragraph mapping.
 */
export interface DocumentChunk {
  index: number;
  pageNumber: number;
  paragraphIndex: number;
  text: string;
}

export type ParseProgressCallback = (
  percent: number,
  currentPage: number,
  totalPages: number
) => void;

function splitIntoSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // ECMAScript standard library sentence segmenter
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(segmenter.segment(clean))
      .map((s) => s.segment.trim())
      .filter((s) => s.length > 0);
  }

  // Regex fallback
  return clean
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extracts document text into sentences (1 line = 1 sentence) grouped by paragraph.
 */
export async function extractChunksFromFile(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<DocumentChunk[]> {
  const lowerName = file.name.toLowerCase();

  // Plain text / Markdown
  if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    file.type.startsWith("text/")
  ) {
    const raw = await file.text();
    const rawParagraphs = raw
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const chunks: DocumentChunk[] = [];
    let chunkIdx = 0;

    rawParagraphs.forEach((para, pIdx) => {
      const sentences = splitIntoSentences(para);
      for (const text of sentences) {
        chunks.push({
          index: chunkIdx++,
          pageNumber: 1,
          paragraphIndex: pIdx,
          text,
        });
      }
    });

    return chunks;
  }

  // PDF text extraction
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const chunks: DocumentChunk[] = [];
  let chunkIdx = 0;
  let paragraphIdx = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const pageParagraphs: string[] = [];
    let currentParagraphText = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str) continue;

      const y =
        "transform" in item && Array.isArray(item.transform)
          ? item.transform[5]
          : null;

      if (lastY !== null && y !== null) {
        const deltaY = Math.abs(y - lastY);
        if (deltaY > 20 || (deltaY > 15 && /[.!?:]\s*$/.test(currentParagraphText))) {
          if (currentParagraphText.trim()) {
            pageParagraphs.push(currentParagraphText.trim());
            currentParagraphText = "";
          }
        }
      }

      currentParagraphText = currentParagraphText ? `${currentParagraphText} ${str}` : str;
      if (y !== null) lastY = y;
    }

    if (currentParagraphText.trim()) {
      pageParagraphs.push(currentParagraphText.trim());
    }

    for (const para of pageParagraphs) {
      const sentences = splitIntoSentences(para);
      for (const text of sentences) {
        chunks.push({
          index: chunkIdx++,
          pageNumber: pageNum,
          paragraphIndex: paragraphIdx,
          text,
        });
      }
      paragraphIdx++;
    }

    if (onProgress) {
      onProgress(
        Math.round((pageNum / pdf.numPages) * 100),
        pageNum,
        pdf.numPages
      );
    }
  }

  return chunks;
}

export const extractChunksFromPdf = extractChunksFromFile;
