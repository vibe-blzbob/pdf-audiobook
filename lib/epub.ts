import JSZip from 'jszip';
import type { DocumentChunk } from './pdf';

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  chunks: DocumentChunk[];
}

export interface EpubBook {
  title: string;
  author?: string;
  chapters: EpubChapter[];
  allChunks: DocumentChunk[];
}

function splitIntoSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  // ECMAScript standard library sentence segmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
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

function resolvePath(basePath: string, relativePath: string): string {
  const stack = basePath ? basePath.split('/') : [];
  stack.pop(); // remove base filename

  const parts = relativePath.split('/');
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

export async function parseEpubFile(file: File): Promise<EpubBook> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Read container.xml to locate the OPF package file
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found');
  }

  const containerXml = await containerFile.async('text');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');

  if (!rootfilePath) {
    throw new Error('Invalid EPUB: OPF rootfile path not found in container.xml');
  }

  // 2. Read OPF package document
  const opfFile = zip.file(rootfilePath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: OPF package file not found at ${rootfilePath}`);
  }

  const opfXml = await opfFile.async('text');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // Metadata
  const title = opfDoc.querySelector('metadata > title, metadata > dc\\:title')?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
  const author = opfDoc.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent?.trim() || undefined;

  // Manifest (id -> href)
  const manifestItems = new Map<string, string>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifestItems.set(id, href);
    }
  });

  // Spine (ordered reading items)
  const spineItemIds: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((itemref) => {
    const idref = itemref.getAttribute('idref');
    if (idref) {
      spineItemIds.push(idref);
    }
  });

  // 3. Process each chapter in spine order
  const chapters: EpubChapter[] = [];
  const allChunks: DocumentChunk[] = [];
  let globalChunkIndex = 0;

  for (let chapterIdx = 0; chapterIdx < spineItemIds.length; chapterIdx++) {
    const id = spineItemIds[chapterIdx];
    const rawHref = manifestItems.get(id);
    if (!rawHref) continue;

    const resolvedHref = resolvePath(rootfilePath, rawHref);
    const chapterFile = zip.file(resolvedHref) || zip.file(decodeURIComponent(resolvedHref));
    if (!chapterFile) continue;

    const chapterHtml = await chapterFile.async('text');
    const chapterDoc = parser.parseFromString(chapterHtml, 'text/html');

    // Extract title from heading or fallback
    const heading = chapterDoc.querySelector('h1, h2, h3, title')?.textContent?.trim();
    const chapterTitle = heading || `Chapter ${chapterIdx + 1}`;

    // Extract textual paragraphs (p, blockquote, li, etc.)
    const textNodes: string[] = [];
    const elements = chapterDoc.querySelectorAll('p, blockquote, li, h1, h2, h3, h4, h5, h6');

    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 0) {
        textNodes.push(text);
      }
    });

    // If no semantic paragraph tags found, fallback to body text
    if (textNodes.length === 0) {
      const bodyText = chapterDoc.body?.textContent?.trim();
      if (bodyText) {
        textNodes.push(bodyText);
      }
    }

    const chapterChunks: DocumentChunk[] = [];
    let pIdx = 0;

    for (const paragraph of textNodes) {
      const sentences = splitIntoSentences(paragraph);
      for (const sentence of sentences) {
        const chunk: DocumentChunk = {
          index: globalChunkIndex++,
          pageNumber: chapterIdx + 1, // mapped to chapter number
          paragraphIndex: pIdx,
          text: sentence,
        };
        chapterChunks.push(chunk);
        allChunks.push(chunk);
      }
      pIdx++;
    }

    // Only include chapters that have readable text content
    if (chapterChunks.length > 0) {
      chapters.push({
        id,
        title: chapterTitle,
        href: resolvedHref,
        chunks: chapterChunks,
      });
    }
  }

  return {
    title,
    author,
    chapters,
    allChunks,
  };
}

