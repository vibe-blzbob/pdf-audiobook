"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Default natural breathing pause between sentences (in milliseconds)
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

export function usePremiumAudiobookPlayer(chunks: string[], voice = "alloy") {
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
  const serverFailedRef = useRef(false);

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
    if (typeof window === "undefined") return;
    activeAudioRef.current = new Audio();
    nextAudioRef.current = new Audio();

    return () => {
      clearPauseTimer();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      activeAudioRef.current?.pause();
      nextAudioRef.current?.pause();
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current.clear();
    };
  }, []);

  // Clear audio cache & reset failure state when voice changes
  useEffect(() => {
    clearPauseTimer();
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    cacheRef.current.clear();
    serverFailedRef.current = false;
    setState((prev) => ({
      ...prev,
      synthesisProgress: { current: 0, total: chunks.length, percent: 0 },
    }));
    if (activeAudioRef.current && state.isPlaying) {
      activeAudioRef.current.pause();
    }
  }, [voice, chunks.length, state.isPlaying]);

  // Fetch and cache a chunk audio blob from backend (sanitizes text, skips empty chunks)
  const fetchChunkAudio = useCallback(
    async (index: number): Promise<string> => {
      if (serverFailedRef.current) {
        throw new Error("Server TTS unavailable; using browser speech");
      }
      if (cacheRef.current.has(index)) {
        return cacheRef.current.get(index)!;
      }
      if (inflightRef.current.has(index)) {
        return inflightRef.current.get(index)!;
      }

      const raw = chunks[index];
      const text = raw ? raw.replace(/\s+/g, " ").trim() : "";
      if (!text || !/\S/.test(text)) {
        return ""; // Skip empty whitespace to avoid buffering
      }

      const promise = (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice }),
          });

          if (!res.ok) {
            serverFailedRef.current = true;
            throw new Error("TTS server offline; falling back");
          }

          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          cacheRef.current.set(index, objectUrl);
          return objectUrl;
        } finally {
          inflightRef.current.delete(index);
        }
      })();

      inflightRef.current.set(index, promise);
      return promise;
    },
    [chunks, voice]
  );

  // Synthesize entire document upfront, stripping empty spaces
  const synthesizeWholeDocument = useCallback(async () => {
    if (!chunks.length) return;

    if (voice.startsWith("native:") || serverFailedRef.current) {
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
        const text = raw ? raw.replace(/\s+/g, " ").trim() : "";
        if (text && /\S/.test(text) && !cacheRef.current.has(i)) {
          try {
            await fetchChunkAudio(i);
          } catch {
            serverFailedRef.current = true;
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
        if (idx < currentIdx) {
          URL.revokeObjectURL(url);
          cacheRef.current.delete(idx);
        }
      }
    }
  }, [state.synthesisProgress.percent]);

  const preloadNextAudioChunk = useCallback(
    async (index: number) => {
      const nextIdx = index + 1;
      if (
        voice.startsWith("native:") ||
        serverFailedRef.current ||
        nextIdx >= chunks.length
      ) {
        return;
      }

      try {
        const nextUrl = await fetchChunkAudio(nextIdx);
        if (nextUrl && nextAudioRef.current && nextAudioRef.current.src !== nextUrl) {
          nextAudioRef.current.src = nextUrl;
          nextAudioRef.current.load();
        }
      } catch {
        // Silent catch on preload
      }
    },
    [chunks.length, fetchChunkAudio, voice]
  );

  // Native Web Speech (auto-skips blank whitespace chunks)
  const playNativeSpeech = useCallback(
    (index: number) => {
      clearPauseTimer();

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isLoading: false,
          error: "Speech synthesis is not supported on this browser.",
        }));
        return;
      }

      const raw = chunks[index];
      const text = raw ? raw.replace(/\s+/g, " ").trim() : "";

      // Instantly advance past empty whitespace chunks without delay
      if (!text || !/\S/.test(text)) {
        const nextIdx = index + 1;
        if (nextIdx < chunks.length) {
          playNativeSpeech(nextIdx);
        } else {
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      const targetVoice = voice.startsWith("native:")
        ? voice.replace("native:", "")
        : null;

      if (targetVoice) {
        const availableVoices = window.speechSynthesis.getVoices();
        const matched = availableVoices.find((v) => v.name === targetVoice);
        if (matched) utterance.voice = matched;
      }

      utterance.onend = () => {
        const nextIndex = currentIndexRef.current + 1;
        if (nextIndex < chunks.length) {
          clearPauseTimer();
          pauseTimerRef.current = setTimeout(() => {
            playNativeSpeech(nextIndex);
          }, SENTENCE_PAUSE_MS);
        } else {
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          setState((prev) => ({
            ...prev,
            isPlaying: false,
            isLoading: false,
            error: `Browser TTS error: ${e.error}`,
          }));
        }
      };

      window.speechSynthesis.speak(utterance);

      setState((prev) => ({
        ...prev,
        currentIndex: index,
        isPlaying: true,
        isLoading: false,
        isNativeFallback: true,
        error: null,
      }));
    },
    [chunks, voice]
  );

  // Play a specific chunk (skips blank chunks, avoids buffering)
  const playChunk = useCallback(
    async (index: number) => {
      clearPauseTimer();

      if (!chunks.length || index < 0 || index >= chunks.length) return;

      const raw = chunks[index];
      const text = raw ? raw.replace(/\s+/g, " ").trim() : "";

      // Skip blank chunks instantly
      if (!text || !/\S/.test(text)) {
        const nextIdx = index + 1;
        if (nextIdx < chunks.length) {
          playChunk(nextIdx);
        } else {
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
        return;
      }

      if (voice.startsWith("native:") || serverFailedRef.current) {
        if (activeAudioRef.current) activeAudioRef.current.pause();
        playNativeSpeech(index);
        return;
      }

      setState((prev) => ({
        ...prev,
        currentIndex: index,
        isLoading: true,
        error: null,
      }));

      try {
        const objectUrl = await fetchChunkAudio(index);

        if (!objectUrl) {
          // Empty audio skipped
          playChunk(index + 1);
          return;
        }

        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.cancel();
        }

        const audio = activeAudioRef.current;
        if (!audio) return;

        if (audio.src !== objectUrl) {
          audio.src = objectUrl;
        }

        await audio.play();

        setState((prev) => ({
          ...prev,
          isPlaying: true,
          isLoading: false,
          isNativeFallback: false,
        }));

        pruneOldChunks(index);
        preloadNextAudioChunk(index);
      } catch {
        serverFailedRef.current = true;
        playNativeSpeech(index);
      }
    },
    [
      chunks,
      voice,
      fetchChunkAudio,
      pruneOldChunks,
      preloadNextAudioChunk,
      playNativeSpeech,
    ]
  );

  // Dual-deck audio progression
  useEffect(() => {
    const handleActiveEnded = () => {
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex >= chunks.length) {
        setState((prev) => ({ ...prev, isPlaying: false }));
        return;
      }

      clearPauseTimer();

      pauseTimerRef.current = setTimeout(() => {
        const nextDeck = nextAudioRef.current;
        const currentDeck = activeAudioRef.current;

        if (nextDeck && nextDeck.src && cacheRef.current.has(nextIndex)) {
          activeAudioRef.current = nextDeck;
          nextAudioRef.current = currentDeck;

          nextDeck
            .play()
            .then(() => {
              setState((prev) => ({
                ...prev,
                currentIndex: nextIndex,
                isPlaying: true,
              }));
              pruneOldChunks(nextIndex);
              preloadNextAudioChunk(nextIndex);
            })
            .catch(() => {
              playChunk(nextIndex);
            });
        } else {
          playChunk(nextIndex);
        }
      }, SENTENCE_PAUSE_MS);
    };

    const audio = activeAudioRef.current;
    if (!audio) return;

    audio.addEventListener("ended", handleActiveEnded);
    return () => {
      audio.removeEventListener("ended", handleActiveEnded);
    };
  }, [chunks.length, playChunk, pruneOldChunks, preloadNextAudioChunk]);

  const togglePlay = useCallback(() => {
    clearPauseTimer();

    if (state.isPlaying) {
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }
      activeAudioRef.current?.pause();
      nextAudioRef.current?.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      if (state.isNativeFallback || voice.startsWith("native:") || serverFailedRef.current) {
        playNativeSpeech(state.currentIndex);
      } else {
        playChunk(state.currentIndex);
      }
    }
  }, [
    state.isPlaying,
    state.isNativeFallback,
    state.currentIndex,
    voice,
    playChunk,
    playNativeSpeech,
  ]);

  const next = useCallback(() => {
    clearPauseTimer();
    if (state.currentIndex + 1 < chunks.length) {
      playChunk(state.currentIndex + 1);
    }
  }, [state.currentIndex, chunks.length, playChunk]);

  const prev = useCallback(() => {
    clearPauseTimer();
    if (state.currentIndex - 1 >= 0) {
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
