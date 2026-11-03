"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import {
  FileUp,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Headphones,
  Loader2,
  Volume2,
  Bookmark,
  Trash2,
  X,
  BookOpen,
  Mic,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { extractChunksFromFile, DocumentChunk } from "@/lib/pdf";
import { usePremiumAudiobookPlayer } from "@/hooks/usePremiumAudiobookPlayer";
import { TextReader } from "@/components/TextReader";
import { useAudiobookStore } from "@/store/useAudiobookStore";

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{
    percent: number;
    currentPage: number;
    totalPages: number;
  } | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [, startTransition] = useTransition();

  // External state store
  const {
    bookmarks,
    selectedVoice,
    setSelectedVoice,
    isBookmarksDrawerOpen,
    toggleBookmarksDrawer,
    setBookmarksDrawerOpen,
    toggleBookmark,
    removeBookmark,
  } = useAudiobookStore();

  // Load available system browser voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      setBrowserVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Audio player consumes raw text strings and selected voice
  const chunkTexts = useMemo(() => chunks.map((c) => c.text), [chunks]);

  const {
    currentIndex,
    isPlaying,
    isLoading,
    isSynthesizing,
    synthesisProgress,
    isNativeFallback,
    error,
    playChunk,
    togglePlay,
    synthesizeWholeDocument,
    next,
    prev,
  } = usePremiumAudiobookPlayer(chunkTexts, selectedVoice);

  const bookmarkedIndices = useMemo(() => {
    return new Set(bookmarks.map((b) => b.chunkIndex));
  }, [bookmarks]);

  const totalPages = useMemo(() => {
    return chunks.length ? Math.max(...chunks.map((c) => c.pageNumber)) : 0;
  }, [chunks]);

  const currentPage = chunks[currentIndex]?.pageNumber || 1;

  const jumpToPage = (pageNum: number) => {
    const targetIdx = chunks.findIndex((c) => c.pageNumber === pageNum);
    if (targetIdx !== -1) {
      playChunk(targetIdx);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isValidFormat =
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      file.type.includes("pdf") ||
      file.type.startsWith("text/");

    if (!isValidFormat) {
      alert("Please upload a PDF (.pdf) or text document (.txt, .md).");
      return;
    }

    setFileName(file.name);
    setIsParsing(true);
    setParsingProgress({ percent: 0, currentPage: 1, totalPages: 1 });

    try {
      const extracted = await extractChunksFromFile(
        file,
        (percent, currentPage, totalPages) => {
          setParsingProgress({ percent, currentPage, totalPages });
        }
      );
      startTransition(() => {
        setChunks(extracted);
      });
    } catch (err) {
      console.error("Document parse failed:", err);
    } finally {
      setIsParsing(false);
      setParsingProgress(null);
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 px-4 py-8 md:px-12 flex flex-col items-center">
      <header className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-zinc-800 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              ScribeAudio
            </h1>
            <p className="text-xs text-zinc-500">
              Interactive Audiobook & Reader
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice Picker Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700/60 rounded-xl text-xs text-zinc-300 shadow-sm">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              aria-label="Select voice"
              className="bg-transparent text-amber-300 font-medium cursor-pointer focus:outline-none max-w-[140px] truncate"
            >
              <optgroup label="AI / Server Voices">
                <option value="alloy" className="bg-zinc-900 text-zinc-200">
                  Alloy (Neutral)
                </option>
                <option value="echo" className="bg-zinc-900 text-zinc-200">
                  Echo (Warm)
                </option>
                <option value="fable" className="bg-zinc-900 text-zinc-200">
                  Fable (British)
                </option>
                <option value="onyx" className="bg-zinc-900 text-zinc-200">
                  Onyx (Deep)
                </option>
                <option value="nova" className="bg-zinc-900 text-zinc-200">
                  Nova (Energetic)
                </option>
                <option value="shimmer" className="bg-zinc-900 text-zinc-200">
                  Shimmer (Clear)
                </option>
              </optgroup>
              {browserVoices.length > 0 && (
                <optgroup label="Installed Browser Voices">
                  {browserVoices.map((v) => (
                    <option
                      key={v.name}
                      value={`native:${v.name}`}
                      className="bg-zinc-900 text-zinc-200"
                    >
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Bookmarks Drawer Trigger */}
          <button
            onClick={toggleBookmarksDrawer}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-sm font-medium transition shadow-sm text-zinc-300"
          >
            <Bookmark
              className={`w-4 h-4 ${
                bookmarks.length > 0 ? "text-amber-400 fill-amber-400" : ""
              }`}
            />
            <span>Bookmarks</span>
            {bookmarks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono">
                {bookmarks.length}
              </span>
            )}
          </button>

          {/* Document Upload */}
          <label className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl cursor-pointer text-sm font-medium transition shadow-sm hover:border-zinc-500">
            <FileUp className="w-4 h-4 text-amber-400" />
            <span>{isParsing ? "Extracting..." : "Upload File"}</span>
            <input
              type="file"
              accept=".pdf,.PDF,application/pdf,application/x-pdf,application/octet-stream,.txt,.md,text/plain,text/markdown"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isParsing}
            />
          </label>
        </div>
      </header>

      {/* PDF Extraction Progress Bar */}
      {isParsing && parsingProgress && (
        <div className="w-full max-w-4xl mt-6 p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 shadow-lg">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-amber-300 font-medium">
              Processing PDF pages...
            </span>
            <span className="font-mono text-zinc-400">
              Page {parsingProgress.currentPage} of {parsingProgress.totalPages} ({parsingProgress.percent}%)
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${parsingProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="w-full max-w-4xl mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Whole Document Synthesis Bar */}
      {chunks.length > 0 && !isParsing && (
        <div className="w-full max-w-4xl mt-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-zinc-300 font-medium">
              {isSynthesizing
                ? `Synthesizing Audio: ${synthesisProgress.current}/${synthesisProgress.total} chunks (${synthesisProgress.percent}%)`
                : synthesisProgress.percent === 100
                ? "Audiobook Fully Synthesized & Cached"
                : "Synthesize full document before playback for instant gapless execution"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isSynthesizing ? (
              <div className="w-36 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${synthesisProgress.percent}%` }}
                />
              </div>
            ) : synthesisProgress.percent === 100 ? (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            ) : (
              <button
                onClick={synthesizeWholeDocument}
                disabled={isSynthesizing}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold shadow transition"
              >
                Synthesize Entire Document
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reader Layout with Per-Page Toolbar and Drawer */}
      <section className="relative w-full max-w-4xl mt-4 flex-1">
        {fileName && (
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
            <span className="truncate max-w-sm font-mono text-zinc-300">
              {fileName}
            </span>

            {/* Page indicator & quick selector */}
            <div className="flex items-center gap-3">
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono text-zinc-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <select
                    value={currentPage}
                    onChange={(e) => jumpToPage(Number(e.target.value))}
                    aria-label="Jump to page"
                    className="ml-1 bg-transparent text-amber-400 text-xs cursor-pointer focus:outline-none"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <option key={p} value={p} className="bg-zinc-900 text-zinc-200">
                          Jump to p.{p}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
              <span>
                {chunks.length > 0
                  ? `Sentence ${currentIndex + 1} of ${chunks.length}`
                  : "No text found"}
              </span>
            </div>
          </div>
        )}

        <div className="relative">
          <TextReader
            chunks={chunks}
            currentIndex={currentIndex}
            bookmarkedChunkIndices={bookmarkedIndices}
            onSelectChunk={playChunk}
            onToggleBookmark={(cIdx, text, pageNum) =>
              toggleBookmark(cIdx, text, 0, pageNum)
            }
          />

          {/* Bookmarks Drawer Overlay */}
          {isBookmarksDrawerOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 border-l border-zinc-800 p-5 rounded-r-2xl shadow-2xl backdrop-blur-xl z-20 flex flex-col animate-in slide-in-from-right">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 font-medium text-sm text-zinc-200">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>Saved Bookmarks</span>
                </div>
                <button
                  onClick={() => setBookmarksDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-2.5">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    No bookmarks yet. Click the bookmark icon on any sentence or selection.
                  </div>
                ) : (
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      onClick={() => {
                        playChunk(bm.chunkIndex);
                        setBookmarksDrawerOpen(false);
                      }}
                      className="group cursor-pointer p-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 transition flex items-start justify-between gap-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {bm.pageNumber && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
                              Page {bm.pageNumber}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400">
                            Chunk {bm.chunkIndex + 1}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
                          {bm.text}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(bm.id);
                        }}
                        className="text-zinc-600 group-hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition"
                        title="Delete bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sticky Audio Controller */}
      {chunks.length > 0 && (
        <footer className="sticky bottom-6 w-full max-w-xl mt-6 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700/50 shadow-2xl backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400 font-medium">
              p.{currentPage} • {currentIndex + 1}/{chunks.length}
            </span>
            <button
              onClick={() =>
                toggleBookmark(
                  currentIndex,
                  chunks[currentIndex]?.text || "",
                  0,
                  currentPage
                )
              }
              className={`p-1.5 rounded-lg border transition ${
                bookmarkedIndices.has(currentIndex)
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
              title="Bookmark current location"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={prev}
              disabled={currentIndex <= 0}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading || isSynthesizing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 translate-x-0.5" />
              )}
            </button>

            <button
              onClick={next}
              disabled={currentIndex >= chunks.length - 1}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition"
              aria-label="Next sentence"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="w-24 text-right">
            {isLoading ? (
              <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                Buffering...
              </span>
            ) : isNativeFallback ? (
              <span
                className="text-[10px] text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60"
                title="Using browser SpeechSynthesis voice"
              >
                Browser Voice
              </span>
            ) : null}
          </div>
        </footer>
      )}
    </main>
  );
}
