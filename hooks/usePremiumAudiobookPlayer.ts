import { useEffect, useRef, useState, useCallback } from 'react';
import { ttsWorkerClient } from '@/lib/workerClient';

const SENTENCE_PAUSE_MS = 250;

interface PlayerState {
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isSynthesizing: boolean;
  synthesisProgress: { current: number; total: number; percent: number };
  isNativeFallback: boolean;
  error: string | null;
}

export function usePremiumAudiobookPlayer(chunks: string[], voice = 'af_heart') {
  const [state, setState] = useState<PlayerState>({
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    isSynthesizing: false,
    synthesisProgress: { current: 0, total: 0, percent: 0 },
    isNativeFallback: false,
    error: null,
  });

  // Dual audio decks for gapless handoff
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Map<number, Promise<string>>>(new Map());
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

  // Clear audio cache when voice changes
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

  // Fetch and cache chunk audio blob from local Kokoro Web Worker
  const fetchChunkAudio = useCallback(
    async (index: number): Promise<string> => {
      if (cacheRef.current.has(index)) {
        return cacheRef.current.get(index)!;
      }
      if (inflightRef.current.has(index)) {
        return inflightRef.current.get(index)!;
      }

      const raw = chunks[index];
      const text = raw ? raw.replace(/\s+/g, ' ').trim() : '';
      if (!text || !/\S/.test(text)) {
        return '';
      }

      const promise = (async () => {
        try {
          const res = await ttsWorkerClient.synthesize(
            `chunk-${index}-${Date.now()}`,
            text,
            voice
          );

          if (!res.audioBlobUrl) {
            throw new Error('Neural synthesis returned empty audio');
          }

          cacheRef.current.set(index, res.audioBlobUrl);
          return res.audioBlobUrl;
        } finally {
          inflightRef.current.delete(index);
        }
      })();

      inflightRef.current.set(index, promise);
      return promise;
    },
    [chunks, voice]
  );

  // Pre-synthesize entire document/chapter in background
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
    if (!state.synthesisProgress.percent || state.synthesisProgress.percent < 100) {
      for (const [idx, url] of cacheRef.current.entries()) {
        if (idx < currentIdx - 2) {
          URL.revokeObjectURL(url);
          cacheRef.current.delete(idx);
        }
      }
    }
  }, [state.synthesisProgress.percent]);

  // Fallback to Native Speech Synthesis API
  const playNativeSpeech = useCallback(
    (index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setState((prev) => ({ ...prev, error: 'Web Speech not supported on this device', isPlaying: false }));
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
        if (e.error !== 'interrupted') {
          setState((prev) => ({ ...prev, error: `Speech error: ${e.error}`, isPlaying: false }));
        }
      };

      window.speechSynthesis.speak(utter);
    },
    [chunks, voice]
  );

  // Play a specific chunk
  const playChunk = useCallback(
    async (index: number) => {
      if (index < 0 || index >= chunks.length) {
        setState((prev) => ({ ...prev, isPlaying: false, currentIndex: 0 }));
        return;
      }

      clearPauseTimer();

      // Check if user selected native voice
      if (voice.startsWith('native:')) {
        playNativeSpeech(index);
        return;
      }

      setState((prev) => ({
        ...prev,
        currentIndex: index,
        isPlaying: true,
        isLoading: !cacheRef.current.has(index),
        isNativeFallback: false,
        error: null,
      }));

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
          fetchChunkAudio(index + 1).then((nextUrl) => {
            if (nextAudioRef.current && nextUrl) {
              nextAudioRef.current.src = nextUrl;
              nextAudioRef.current.load();
            }
          }).catch(console.warn);
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
    next,
    prev,
  };
}
