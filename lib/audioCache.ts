import { createStore, get, set, del, clear } from 'idb-keyval';

const audioStore = createStore('pdf-audiobook-audio-cache', 'audio-chunks');

export function getAudioCacheKey(bookName: string, chunkIndex: number, voice: string): string {
  // Normalize bookName to remove path/extension quirks
  const safeBook = bookName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeBook}::chunk_${chunkIndex}::${voice}`;
}

export async function getCachedAudioBlob(key: string): Promise<Blob | null> {
  try {
    const blob = await get<Blob>(key, audioStore);
    return blob || null;
  } catch (err) {
    console.warn('[AudioCache] Read error:', err);
    return null;
  }
}

export async function setCachedAudioBlob(key: string, blob: Blob): Promise<void> {
  try {
    await set(key, blob, audioStore);
  } catch (err) {
    console.warn('[AudioCache] Write error:', err);
  }
}

export async function getChapterCacheStatus(
  bookName: string,
  chunkIndices: number[],
  voice: string
): Promise<{ cachedCount: number; totalCount: number; cachedBlobs: Map<number, Blob> }> {
  const cachedBlobs = new Map<number, Blob>();
  let cachedCount = 0;

  for (const idx of chunkIndices) {
    const key = getAudioCacheKey(bookName, idx, voice);
    const blob = await getCachedAudioBlob(key);
    if (blob) {
      cachedCount++;
      cachedBlobs.set(idx, blob);
    }
  }

  return {
    cachedCount,
    totalCount: chunkIndices.length,
    cachedBlobs,
  };
}

export async function clearChapterAudioCache(
  bookName: string,
  chunkIndices: number[],
  voice: string
): Promise<void> {
  for (const idx of chunkIndices) {
    const key = getAudioCacheKey(bookName, idx, voice);
    try {
      await del(key, audioStore);
    } catch (err) {
      console.warn('[AudioCache] Delete error:', err);
    }
  }
}

export async function getStorageUsage(): Promise<{ usageMB: number; quotaMB: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return {
        usageMB: Math.round((usage / (1024 * 1024)) * 10) / 10,
        quotaMB: Math.round((quota / (1024 * 1024)) * 10) / 10,
      };
    } catch {
      // fallback
    }
  }
  return { usageMB: 0, quotaMB: 0 };
}

export async function clearAudioCache(): Promise<void> {
  try {
    await clear(audioStore);
  } catch (err) {
    console.warn('[AudioCache] Clear error:', err);
  }
}
