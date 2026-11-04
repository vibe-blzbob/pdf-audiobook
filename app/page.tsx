import React, { useState, useTransition, useMemo, useEffect, useRef } from 'react';
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
  Sparkles,
  List,
  RotateCcw,
} from 'lucide-react';
import { extractChunksFromFile, DocumentChunk } from '@/lib/pdf';
import { parseEpubFile, type EpubBook } from '@/lib/epub';
import { usePremiumAudiobookPlayer } from '@/hooks/usePremiumAudiobookPlayer';
import { TextReader } from '@/components/TextReader';
import { ChapterList } from '@/components/ChapterList';
import { ModelStatusBanner } from '@/components/ModelStatusBanner';
import { useAudiobookStore } from '@/store/useAudiobookStore';
import { KOKORO_VOICES } from '@/lib/voices';
import {
  saveCurrentBook,
  loadCurrentBook,
  clearCurrentBook,
  saveReadingPosition,
  loadReadingPosition,
} from '@/lib/storage';

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [epubBook, setEpubBook] = useState<EpubBook | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{
    percent: number;
    currentPage: number;
    totalPages: number;
  } | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [, startTransition] = useTransition();
  const hasRestoredRef = useRef(false);

  const {
    bookmarks,
    selectedVoice,
    activeChapterIndex,
    isBookmarksDrawerOpen,
    isChapterListOpen,
    setSelectedVoice,
    setActiveChapterIndex,
    toggleBookmarksDrawer,
    setBookmarksDrawerOpen,
    toggleChapterList,
    setChapterListOpen,
    toggleBookmark,
    removeBookmark,
  } = useAudiobookStore();

  // Load available system browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      setBrowserVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

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

  // Restore book and reading position on first load
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    loadCurrentBook().then((record) => {
      if (record && record.chunks.length > 0) {
        setFileName(record.fileName);
        setEpubBook(record.book);
        setChunks(record.chunks);

        loadReadingPosition().then((pos) => {
          if (pos) {
            setActiveChapterIndex(pos.chapterIndex);
          }
        });
      }
    });
  }, [setActiveChapterIndex]);

  // Persist reading position periodically during playback
  useEffect(() => {
    if (chunks.length > 0) {
      saveReadingPosition({
        chunkIndex: currentIndex,
        chapterIndex: activeChapterIndex,
      });
    }
  }, [currentIndex, activeChapterIndex, chunks.length]);

  const bookmarkedIndices = useMemo(() => {
    return new Set(bookmarks.map((b) => b.chunkIndex));
  }, [bookmarks]);

  const handleSelectChapter = (chapterIdx: number) => {
    if (!epubBook || !epubBook.chapters[chapterIdx]) return;
    setActiveChapterIndex(chapterIdx);
    const targetChapter = epubBook.chapters[chapterIdx];
    if (targetChapter.chunks.length > 0) {
      const firstChunkGlobalIndex = targetChapter.chunks[0].index;
      playChunk(firstChunkGlobalIndex);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isEpub = lowerName.endsWith('.epub');
    const isPdfOrText =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      file.type.includes('pdf') ||
      file.type.startsWith('text/');

    if (!isEpub && !isPdfOrText) {
      alert('Please upload an EPUB (.epub), PDF (.pdf), or text document (.txt, .md).');
      return;
    }

    setFileName(file.name);
    setIsParsing(true);
    setParsingProgress({ percent: 0, currentPage: 1, totalPages: 1 });

    try {
      if (isEpub) {
        const book = await parseEpubFile(file);
        startTransition(() => {
          setEpubBook(book);
          setChunks(book.allChunks);
          setActiveChapterIndex(0);
        });

        await saveCurrentBook({
          fileName: file.name,
          book,
          chunks: book.allChunks,
          lastSavedAt: Date.now(),
        });
      } else {
        setEpubBook(null);
        const extracted = await extractChunksFromFile(
          file,
          (percent, currentPage, totalPages) => {
            setParsingProgress({ percent, currentPage, totalPages });
          }
        );
        startTransition(() => {
          setChunks(extracted);
        });

        await saveCurrentBook({
          fileName: file.name,
          book: null,
          chunks: extracted,
          lastSavedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Document parse failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsParsing(false);
      setParsingProgress(null);
    }
  };

  const handleClearBook = async () => {
    if (confirm('Clear the current book and reading progress?')) {
      await clearCurrentBook();
      setFileName(null);
      setEpubBook(null);
      setChunks([]);
    }
  };

  const currentChapter = epubBook?.chapters[activeChapterIndex];

  return (
    <main className="min-h-screen bg-black text-zinc-100 px-4 py-6 md:px-12 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between pb-4 border-b border-zinc-800 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Offline Neural Ebook Reader
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                PWA • 100% Client-Side
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Read and listen to EPUBs with local neural voices without internet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {epubBook && epubBook.chapters.length > 0 && (
            <button
              onClick={toggleChapterList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-950/50 border border-purple-800/60 rounded-lg hover:bg-purple-900/50 transition cursor-pointer"
              title="Table of Contents"
            >
              <List className="w-3.5 h-3.5" />
              <span>Chapters ({epubBook.chapters.length})</span>
            </button>
          )}

          {chunks.length > 0 && (
            <button
              onClick={handleClearBook}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-rose-300 rounded-lg hover:bg-zinc-900 transition"
              title="Close book"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleBookmarksDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition relative cursor-pointer"
            title="Bookmarks"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Bookmarks</span>
            {bookmarks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Model Offline Status Indicator */}
      <div className="w-full max-w-4xl pt-4 pb-2 flex justify-start">
        <ModelStatusBanner />
      </div>

      {/* Upload Zone & Voice Settings */}
      <section className="w-full max-w-4xl mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* File Dropzone */}
        <div className="md:col-span-2 border border-dashed border-zinc-800 hover:border-purple-500/50 bg-zinc-950/60 rounded-xl p-5 flex flex-col items-center justify-center text-center transition group">
          <input
            type="file"
            accept=".epub,.pdf,.txt,.md"
            onChange={handleFileUpload}
            disabled={isParsing}
            className="hidden"
            id="book-upload"
          />
          <label htmlFor="book-upload" className="cursor-pointer flex flex-col items-center">
            {isParsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs text-zinc-300 font-medium">
                  {parsingProgress
                    ? `Parsing page ${parsingProgress.currentPage} of ${parsingProgress.totalPages}...`
                    : 'Parsing EPUB / document...'}
                </span>
              </div>
            ) : (
              <>
                <FileUp className="w-6 h-6 text-zinc-500 group-hover:text-purple-400 transition mb-2" />
                <span className="text-xs font-semibold text-zinc-200">
                  {fileName ? (
                    <span className="text-purple-300">{fileName}</span>
                  ) : (
                    'Click or drag an EPUB, PDF, or text file here'
                  )}
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">
                  Supports .epub with chapters &amp; .pdf documents (cached in IndexedDB)
                </span>
              </>
            )}
          </label>
        </div>

        {/* Voice Selector */}
        <div className="border border-zinc-800 bg-zinc-950/60 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Voice Selection
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">Offline Neural</span>
            </div>

            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <optgroup label="Kokoro Neural Voices (100% Offline)">
                {KOKORO_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.accent} {v.gender}) {v.grade ? `[${v.grade}]` : ''}
                  </option>
                ))}
              </optgroup>

              {browserVoices.length > 0 && (
                <optgroup label="Device Web Speech (Fallback)">
                  {browserVoices.map((v) => (
                    <option key={v.voiceURI} value={`native:${v.name}`}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {chunks.length > 0 && (
            <button
              onClick={synthesizeWholeDocument}
              disabled={isSynthesizing}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Pre-synthesizing ({synthesisProgress.percent}%)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Pre-cache All Audio</span>
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* Reader Main Section */}
      <section className="w-full max-w-4xl mt-5 flex-1 flex flex-col">
        {epubBook && (
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/40 px-3.5 py-2 rounded-lg border border-zinc-800/80">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-zinc-200">{epubBook.title}</span>
              {epubBook.author && <span className="text-zinc-500">by {epubBook.author}</span>}
              {currentChapter && (
                <span className="text-purple-300 font-mono text-[11px] truncate">
                  • {currentChapter.title}
                </span>
              )}
            </div>
            <button
              onClick={toggleChapterList}
              className="text-purple-400 hover:text-purple-300 text-[11px] underline flex-shrink-0 cursor-pointer"
            >
              Change Chapter
            </button>
          </div>
        )}

        <div className="relative flex-1 bg-zinc-950/70 border border-zinc-800 rounded-2xl min-h-[460px] overflow-hidden flex flex-col">
          {chunks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
              <BookOpen className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-zinc-400">No book loaded</p>
              <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                Upload an EPUB ebook or document above to begin reading and listening with offline neural narration.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 leading-relaxed text-zinc-300 text-sm">
              <TextReader
                chunks={chunks}
                currentIndex={currentIndex}
                bookmarkedChunkIndices={bookmarkedIndices}
                onSelectChunk={(idx) => playChunk(idx)}
                onToggleBookmark={(cIdx, text, pageNum) =>
                  toggleBookmark(cIdx, text, activeChapterIndex, pageNum)
                }
              />
            </div>
          )}

          {/* Bookmarks Drawer */}
          {isBookmarksDrawerOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 border-l border-zinc-800 p-5 rounded-r-2xl shadow-2xl backdrop-blur-xl z-20 flex flex-col animate-in slide-in-from-right">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 font-medium text-sm text-zinc-200">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>Saved Bookmarks</span>
                </div>
                <button
                  onClick={() => setBookmarksDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-2.5">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    No bookmarks yet. Click the bookmark icon next to any sentence.
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
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300">
                            Line #{bm.chunkIndex + 1}
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
                        className="text-zinc-600 group-hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition cursor-pointer"
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

      {/* Floating Sticky Audio Controller */}
      {chunks.length > 0 && (
        <footer className="sticky bottom-4 w-full max-w-xl mt-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-700/60 shadow-2xl backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-zinc-300 font-mono">
              {currentIndex + 1} / {chunks.length}
            </span>
            <button
              onClick={() =>
                toggleBookmark(
                  currentIndex,
                  chunks[currentIndex]?.text || '',
                  activeChapterIndex,
                  chunks[currentIndex]?.pageNumber
                )
              }
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                bookmarkedIndices.has(currentIndex)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Bookmark current sentence"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              disabled={currentIndex <= 0}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition transform active:scale-95 flex items-center justify-center cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              disabled={currentIndex >= chunks.length - 1}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              aria-label="Next sentence"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isNativeFallback ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                Web Speech
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                Kokoro
              </span>
            )}
          </div>
        </footer>
      )}

      {/* Chapter List Modal */}
      {epubBook && (
        <ChapterList
          chapters={epubBook.chapters}
          activeChapterIndex={activeChapterIndex}
          isOpen={isChapterListOpen}
          onSelectChapter={handleSelectChapter}
          onClose={() => setChapterListOpen(false)}
        />
      )}
    </main>
  );
}
