import { get, set, del } from 'idb-keyval';
import type { EpubBook } from './epub';
import type { DocumentChunk } from './pdf';

const ACTIVE_BOOK_KEY = 'active_offline_book';
const READING_POSITION_KEY = 'reading_position';

export interface SavedBookRecord {
  fileName: string;
  book: EpubBook | null;
  chunks: DocumentChunk[];
  lastSavedAt: number;
}

export interface SavedReadingPosition {
  chunkIndex: number;
  chapterIndex: number;
}

export async function saveCurrentBook(record: SavedBookRecord): Promise<void> {
  try {
    await set(ACTIVE_BOOK_KEY, record);
  } catch (err) {
    console.warn('[Storage] Failed to save book to IndexedDB:', err);
  }
}

export async function loadCurrentBook(): Promise<SavedBookRecord | null> {
  try {
    const record = await get<SavedBookRecord>(ACTIVE_BOOK_KEY);
    return record || null;
  } catch (err) {
    console.warn('[Storage] Failed to load book from IndexedDB:', err);
    return null;
  }
}

export async function clearCurrentBook(): Promise<void> {
  try {
    await del(ACTIVE_BOOK_KEY);
    await del(READING_POSITION_KEY);
  } catch (err) {
    console.warn('[Storage] Failed to clear book from IndexedDB:', err);
  }
}

export async function saveReadingPosition(pos: SavedReadingPosition): Promise<void> {
  try {
    await set(READING_POSITION_KEY, pos);
  } catch (err) {
    console.warn('[Storage] Failed to save reading position:', err);
  }
}

export async function loadReadingPosition(): Promise<SavedReadingPosition | null> {
  try {
    const pos = await get<SavedReadingPosition>(READING_POSITION_KEY);
    return pos || null;
  } catch (err) {
    console.warn('[Storage] Failed to load reading position:', err);
    return null;
  }
}

