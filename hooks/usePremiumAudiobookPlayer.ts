import { useEffect, useRef, useState, useCallback } from 'react';
import { ttsWorkerClient } from '@/lib/workerClient';
import {
  getAudioCacheKey,
  getCachedAudioBlob,
  setCachedAudioBlob,
  clearChapterAudioCache,
} from '@/lib/audioCache';
import { encodeWavBlobsToMp3 } from '@/lib/mp3Encoder';

const SENTENCE_PAUSE_MS = 250;

export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `~${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `~${mins}m ${secs}s left` : `~${mins}m left`;
}

interface PlayerState {
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isSynthesizing: boolean;
  synthesisProgress: { current: number; total: number; percent: number };
  isNativeFallback: boolean;
  error: string | null;
}

export interface CachingProgress {
  isCaching: boolean;
  current: number;
  total: number;
  percent: number;
  speedSec: number | null;
  etaSec: number | null;
  etaText: string | null;
}

export interface ExportProgress {
  isExporting: boolean;
  current: number;
  total: number;
  percent: number;
}

export function usePremiumAudiobookPlayer(
  chunks: string[],
  voice = 'af_heart',
  bookName = 'default_book'
) {
  const [state, setState] = useState<PlayerState>({
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    isSynthesizing: false,
    synthesisProgress: { current: 0, total: 0, percent: 0 },
    isNativeFallback: false,
    error: null,
  });

  const [cachingProgress, setCachingProgress] = useState<CachingProgress | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [lastChunkSpeedSec, setLastChunkSpeedSec] = useState<number | null>(null);

  const abortCachingRef = useRef(false);

  // Dual audio decks for gapless handoff
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Map<string, Promise<string>>>(new Map());
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentIndexRef = useRef(0);
  currentIndexRef.current = state.currentIndex;

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  // Initialize audio decks once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    activeAudioRef.current = new Audio();
    nextAudioRef.current = new Audio();

    return () => {
      clearPauseTimer();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      activeAudioRef.current?.pause();
      nextAudioRef.current?.pause();
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current.clear();
    };
  }, []);

  // Clear in-memory URL cache when voice changes
  useEffect(() => {
    clearPauseTimer();
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    cacheRef.current.clear();
    setState((prev) => ({
      ...prev,
      synthesisProgress: { current: 0, total: chunks.length, percent: 0 },
    }));
    if (activeAudioRef.current && state.isPlaying) {
      activeAudioRef.current.pause();
    }
  }, [voice, chunks.length, state.isPlaying]);

  // Fetch and cache chunk audio blob (checks IndexedDB first, then local Web Worker)
  const fetchChunkAudio = useCallback(
    async (index: number, voiceOverride?: string): Promise<string> => {
      const activeVoice = voiceOverride || voice;
      const isPlayerVoice = activeVoice === voice;

      // 1. In-memory check (only for active listening voice)
      if (isPlayerVoice && cacheRef.current.has(index)) {
        return cacheRef.current.get(index)!;
      }

      const inflightKey = `${index}::${activeVoice}`;
      if (inflightRef.current.has(inflightKey)) {
        return inflightRef.current.get(inflightKey)!;
      }

      const raw = chunks[index];
      const text = raw ? raw.replace(/\s+/g, ' ').trim() : '';
      if (!text || !/\S/.test(text)) {
        return '';
      }

      const cacheKey = getAudioCacheKey(bookName, index, activeVoice);

      const promise = (async () => {
        try {
          // 2. Persistent IndexedDB check
          const cachedBlob = await getCachedAudioBlob(cacheKey);
          if (cachedBlob) {
            const url = URL.createObjectURL(cachedBlob);
            if (isPlayerVoice) cacheRef.current.set(index, url);
            return url;
          }

          // 3. Neural synthesis via local Kokoro Web Worker
          const startTime = performance.now();
          const res = await ttsWorkerClient.synthesize(
            `chunk-${index}-${Date.now()}`,
            text,
            activeVoice
          );

          if (!res.audioBlobUrl) {
            throw new Error('Neural synthesis returned empty audio');
          }

          const elapsed = (performance.now() - startTime) / 1000;
          setLastChunkSpeedSec(elapsed);

          // Persist blob into IndexedDB
          if (res.audioBlob) {
            await setCachedAudioBlob(cacheKey, res.audioBlob);
          }

          if (isPlayerVoice) cacheRef.current.set(index, res.audioBlobUrl);
          return res.audioBlobUrl;
        } finally {
          inflightRef.current.delete(inflightKey);
        }
      })();

      inflightRef.current.set(inflightKey, promise);
      return promise;
    },
    [chunks, voice, bookName]
  );

  // Pre-synthesize entire chapter in background
  const cacheChapter = useCallback(
    async (chapterChunkIndices: number[], targetVoice?: string) => {
      const activeVoice = targetVoice || voice;
      if (!chapterChunkIndices.length || activeVoice.startsWith('native:')) return;

      abortCachingRef.current = false;
      setCachingProgress({
        isCaching: true,
        current: 0,
        total: chapterChunkIndices.length,
        percent: 0,
        speedSec: null,
        etaSec: null,
        etaText: null,
      });

      try {
        let completed = 0;
        const recentTimes: number[] = [];

        for (let i = 0; i < chapterChunkIndices.length; i++) {
          if (abortCachingRef.current) break;

          const chunkIdx = chapterChunkIndices[i];
          const t0 = performance.now();
          await fetchChunkAudio(chunkIdx, activeVoice);
          const chunkElapsed = (performance.now() - t0) / 1000;

          if (chunkElapsed > 0.05) {
            recentTimes.push(chunkElapsed);
            if (recentTimes.length > 5) recentTimes.shift();
          }

          completed++;
          const avgSpeed =
            recentTimes.length > 0
              ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
              : null;
          const remainingChunks = chapterChunkIndices.length - completed;
          const etaSec = avgSpeed ? Math.round(remainingChunks * avgSpeed) : null;

          setCachingProgress({
            isCaching: true,
            current: completed,
            total: chapterChunkIndices.length,
            percent: Math.round((completed / chapterChunkIndices.length) * 100),
            speedSec: avgSpeed,
            etaSec,
            etaText: formatEta(etaSec),
          });
        }
      } finally {
        setCachingProgress((prev) => (prev ? { ...prev, isCaching: false } : null));
      }
    },
    [voice, fetchChunkAudio]
  );

  const cancelCaching = useCallback(() => {
    abortCachingRef.current = true;
    setCachingProgress((prev) => (prev ? { ...prev, isCaching: false } : null));
  }, []);

  // Concatenate chapter audio chunks and export as MP3 (auto-clears cache afterward)
  const downloadChapterMp3 = useCallback(
    async (chapterTitle: string, chapterChunkIndices: number[], targetVoice?: string) => {
      if (!chapterChunkIndices.length) return;
      const activeVoice = targetVoice || voice;

      setExportProgress({
        isExporting: true,
        current: 0,
        total: chapterChunkIndices.length,
        percent: 0,
      });

      try {
        const blobs: Blob[] = [];

        for (let i = 0; i < chapterChunkIndices.length; i++) {
          const idx = chapterChunkIndices[i];
          const cacheKey = getAudioCacheKey(bookName, idx, activeVoice);
          let blob = await getCachedAudioBlob(cacheKey);

          if (!blob) {
            const raw = chunks[idx];
            const text = raw ? raw.replace(/\s+/g, ' ').trim() : '';
            if (text && /\S/.test(text)) {
              const res = await ttsWorkerClient.synthesize(
                `export-${idx}-${Date.now()}`,
                text,
                activeVoice
              );
              if (res.audioBlob) {
                blob = res.audioBlob;
                await setCachedAudioBlob(cacheKey, blob);
              }
            }
          }

          if (blob) {
            blobs.push(blob);
          }
        }

        if (blobs.length === 0) {
          throw new Error('No audio found to export');
        }

        const mp3Blob = await encodeWavBlobsToMp3(
          blobs,
          (p) => {
            setExportProgress({
              isExporting: true,
              current: p.current,
              total: p.total,
              percent: p.percent,
            });
          },
          SENTENCE_PAUSE_MS
        );

        const safeTitle =
          (chapterTitle || 'Chapter').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Audiobook_Chapter';
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Auto-clear cache after downloading the MP3
        await clearChapterAudioCache(bookName, chapterChunkIndices, activeVoice);
        if (activeVoice === voice) {
          for (const idx of chapterChunkIndices) {
            const u = cacheRef.current.get(idx);
            if (u) {
              URL.revokeObjectURL(u);
              cacheRef.current.delete(idx);
            }
          }
        }
      } catch (err) {
        console.error('[Player] MP3 export error:', err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to export chapter MP3',
        }));
      } finally {
        setExportProgress(null);
      }
    },
    [bookName, voice, chunks]
  );

  // Pre-synthesize entire document in background
  const synthesizeWholeDocument = useCallback(async () => {
    if (!chunks.length) return;

    if (voice.startsWith('native:')) {
      setState((prev) => ({
        ...prev,
        isSynthesizing: false,
        synthesisProgress: { current: chunks.length, total: chunks.length, percent: 100 },
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isSynthesizing: true,
      error: null,
      synthesisProgress: { current: 0, total: chunks.length, percent: 0 },
    }));

    try {
      for (let i = 0; i < chunks.length; i++) {
        const raw = chunks[i];
        const text = raw ? raw.replace(/\s+/g, ' ').trim() : '';
        if (text && /\S/.test(text) && !cacheRef.current.has(i)) {
          try {
            await fetchChunkAudio(i);
          } catch (err) {
            console.warn(`[Player] Error pre-synthesizing chunk ${i}:`, err);
            break;
          }
        }

        const currentCount = i + 1;
        const percent = Math.round((currentCount / chunks.length) * 100);
        setState((prev) => ({
          ...prev,
          synthesisProgress: { current: currentCount, total: chunks.length, percent },
        }));
      }
    } finally {
      setState((prev) => ({
        ...prev,
        isSynthesizing: false,
      }));
    }
  }, [chunks, voice, fetchChunkAudio]);

  const pruneOldChunks = useCallback((currentIdx: number) => {
    for (const [idx, url] of cacheRef.current.entries()) {
      if (idx < currentIdx - 2) {
        URL.revokeObjectURL(url);
        cacheRef.current.delete(idx);
      }
    }
  }, []);

  // Fallback to Native Speech Synthesis API
  const playNativeSpeech = useCallback(
    (index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setState((prev) => ({
          ...prev,
          error: 'Web Speech not supported on this device',
          isPlaying: false,
        }));
        return;
      }

      window.speechSynthesis.cancel();
      const rawText = chunks[index];
      const text = rawText ? rawText.replace(/\s+/g, ' ').trim() : '';

      if (!text) {
        if (index + 1 < chunks.length) {
          setState((prev) => ({ ...prev, currentIndex: index + 1 }));
          playNativeSpeech(index + 1);
        } else {
          setState((prev) => ({ ...prev, isPlaying: false, currentIndex: 0 }));
        }
        return;
      }

      const utter = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utter;

      const voiceId = voice.replace('native:', '');
      const availableVoices = window.speechSynthesis.getVoices();
      const matched = availableVoices.find((v) => v.name === voiceId || v.voiceURI === voiceId);
      if (matched) utter.voice = matched;

      utter.onstart = () => {
        setState((prev) => ({
          ...prev,
          currentIndex: index,
          isPlaying: true,
          isLoading: false,
          isNativeFallback: true,
          error: null,
        }));
      };

      utter.onend = () => {
        clearPauseTimer();
        pauseTimerRef.current = setTimeout(() => {
          if (index + 1 < chunks.length) {
            playNativeSpeech(index + 1);
          } else {
            setState((prev) => ({ ...prev, isPlaying: false, currentIndex: 0 }));
          }
        }, SENTENCE_PAUSE_MS);
      };

      utter.onerror = (e) => {
        if (e.error !== 'canceled') {
          setState((prev) => ({
            ...prev,
            error: `Speech synthesis error: ${e.error}`,
            isPlaying: false,
          }));
        }
      };

      window.speechSynthesis.speak(utter);
    },
    [chunks, voice]
  );

  // Play chunk via local Neural Kokoro TTS
  const playChunk = useCallback(
    async (index: number) => {
      if (index < 0 || index >= chunks.length) return;

      clearPauseTimer();
      setState((prev) => ({
        ...prev,
        currentIndex: index,
        isPlaying: true,
        isLoading: true,
        error: null,
      }));

      // Native browser speech synthesis
      if (voice.startsWith('native:')) {
        playNativeSpeech(index);
        return;
      }

      try {
        const audioUrl = await fetchChunkAudio(index);
        if (!audioUrl) {
          if (index + 1 < chunks.length) {
            playChunk(index + 1);
          } else {
            setState((prev) => ({ ...prev, isPlaying: false, currentIndex: 0 }));
          }
          return;
        }

        const audio = activeAudioRef.current;
        if (!audio) return;

        audio.src = audioUrl;

        // Gapless lookahead: pre-fetch next chunk while current plays
        if (index + 1 < chunks.length) {
          fetchChunkAudio(index + 1)
            .then((nextUrl) => {
              if (nextAudioRef.current && nextUrl) {
                nextAudioRef.current.src = nextUrl;
                nextAudioRef.current.load();
              }
            })
            .catch(console.warn);
        }

        audio.oncanplay = () => {
          setState((prev) => ({ ...prev, isLoading: false }));
          audio.play().catch((err) => {
            if (err.name !== 'AbortError') {
              setState((prev) => ({ ...prev, error: 'Autoplay error', isPlaying: false }));
            }
          });
        };

        audio.onended = () => {
          pruneOldChunks(index);
          clearPauseTimer();
          pauseTimerRef.current = setTimeout(() => {
            if (index + 1 < chunks.length) {
              playChunk(index + 1);
            } else {
              setState((prev) => ({ ...prev, isPlaying: false, currentIndex: 0 }));
            }
          }, SENTENCE_PAUSE_MS);
        };

        audio.onerror = () => {
          console.warn('[Audio] Playback error, falling back to native voice');
          playNativeSpeech(index);
        };
      } catch (err) {
        console.warn('[Audio] Neural synthesis error, falling back to native voice:', err);
        playNativeSpeech(index);
      }
    },
    [chunks, voice, fetchChunkAudio, playNativeSpeech, pruneOldChunks]
  );

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      clearPauseTimer();
      if (activeAudioRef.current) activeAudioRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      playChunk(state.currentIndex);
    }
  }, [state.isPlaying, state.currentIndex, playChunk]);

  const next = useCallback(() => {
    if (state.currentIndex + 1 < chunks.length) {
      playChunk(state.currentIndex + 1);
    }
  }, [state.currentIndex, chunks.length, playChunk]);

  const prev = useCallback(() => {
    if (state.currentIndex > 0) {
      playChunk(state.currentIndex - 1);
    }
  }, [state.currentIndex, playChunk]);

  return {
    ...state,
    playChunk,
    togglePlay,
    synthesizeWholeDocument,
    cacheChapter,
    cancelCaching,
    downloadChapterMp3,
    cachingProgress,
    exportProgress,
    lastChunkSpeedSec,
    next,
    prev,
  };
}
