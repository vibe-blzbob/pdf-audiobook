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
  Download,
  Square,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { extractChunksFromFile, DocumentChunk } from '@/lib/pdf';
import { parseEpubFile, type EpubBook } from '@/lib/epub';
import { usePremiumAudiobookPlayer } from '@/hooks/usePremiumAudiobookPlayer';
import { TextReader } from '@/components/TextReader';
import { ChapterList } from '@/components/ChapterList';
import { ModelStatusBanner } from '@/components/ModelStatusBanner';
import { ResourceMonitor } from '@/components/ResourceMonitor';
import { useResourceMonitor } from '@/hooks/useResourceMonitor';
import { getChapterCacheStatus } from '@/lib/audioCache';
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
    cacheChapter,
    cancelCaching,
    downloadChapterMp3,
    cachingProgress,
    exportProgress,
    lastChunkSpeedSec,
    next,
    prev,
  } = usePremiumAudiobookPlayer(chunkTexts, selectedVoice, fileName || 'default_book');

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

  const currentChapter = epubBook?.chapters[activeChapterIndex];

  const activeChapterChunks = useMemo(() => {
    if (epubBook && currentChapter) {
      return currentChapter.chunks;
    }
    return chunks;
  }, [epubBook, currentChapter, chunks]);

  const activeChapterChunkIndices = useMemo(() => {
    return activeChapterChunks.map((c) => c.index);
  }, [activeChapterChunks]);

  const activeChapterTitle = useMemo(() => {
    if (epubBook && currentChapter) {
      return currentChapter.title;
    }
    return fileName?.replace(/\.[^/.]+$/, '') || 'Audiobook Chapter';
  }, [epubBook, currentChapter, fileName]);

  const [chapterCachedCount, setChapterCachedCount] = useState<number>(0);

  useEffect(() => {
    if (!fileName || !activeChapterChunkIndices.length) {
      setChapterCachedCount(0);
      return;
    }

    let isMounted = true;
    getChapterCacheStatus(fileName, activeChapterChunkIndices, selectedVoice).then((res) => {
      if (isMounted) {
        setChapterCachedCount(res.cachedCount);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fileName, activeChapterChunkIndices, selectedVoice, cachingProgress?.percent, currentIndex]);

  const { metrics: resourceMetrics } = useResourceMonitor(
    lastChunkSpeedSec || cachingProgress?.speedSec || null
  );

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
          setActiveChapterIndex(0);
        });

        await saveCurrentBook({
          fileName: file.name,
          book: null,
          chunks: extracted,
          lastSavedAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Error reading document: ${err.message || 'Unknown parsing failure'}`);
      setFileName(null);
      setEpubBook(null);
      setChunks([]);
    } finally {
      setIsParsing(false);
      setParsingProgress(null);
      e.target.value = '';
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
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Close Book</span>
            </button>
          )}

          <button
            onClick={toggleBookmarksDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-400" />
            <span>Bookmarks ({bookmarks.length})</span>
          </button>
        </div>
      </header>

      {/* Model Offline Status Indicator & Live Resource Monitor */}
      <div className="w-full max-w-4xl pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
        <ModelStatusBanner />
        {chunks.length > 0 && (
          <ResourceMonitor
            metrics={resourceMetrics}
            isProcessing={cachingProgress?.isCaching || exportProgress?.isExporting}
          />
        )}
      </div>

      {/* Upload Zone & Voice Settings */}
      <section className="w-full max-w-4xl mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* File Dropzone */}
        <div className="border border-dashed border-zinc-800 hover:border-purple-500/50 bg-zinc-950/60 transition-colors rounded-xl p-4 flex flex-col items-center justify-center text-center relative group min-h-[140px] md:col-span-2">
          <input
            type="file"
            accept=".epub,.pdf,.txt,.md"
            onChange={handleFileUpload}
            disabled={isParsing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <label className="flex flex-col items-center pointer-events-none">
            {isParsing ? (
              <>
                <Loader2 className="w-7 h-7 text-purple-400 animate-spin mb-2" />
                <span className="text-xs font-medium text-zinc-300">
                  Parsing document ({parsingProgress?.percent || 0}%)
                </span>
                <span className="text-[11px] text-zinc-500 mt-1 font-mono">
                  {parsingProgress
                    ? `Page ${parsingProgress.currentPage} of ${parsingProgress.totalPages}`
                    : 'Segmenting text...'}
                </span>
              </>
            ) : fileName ? (
              <>
                <BookOpen className="w-7 h-7 text-purple-400 mb-2" />
                <span className="text-xs font-semibold text-zinc-200 truncate max-w-sm">
                  {fileName}
                </span>
                <span className="text-[11px] text-zinc-500 mt-1">
                  {epubBook
                    ? `${epubBook.chapters.length} chapters • ${chunks.length} sentences`
                    : `${chunks.length} sentences extracted`}
                </span>
                <span className="text-[10px] text-purple-400/80 mt-1.5 underline">
                  Click or drop to switch book
                </span>
              </>
            ) : (
              <>
                <FileUp className="w-7 h-7 text-zinc-500 group-hover:text-purple-400 mb-2 transition" />
                <span className="text-xs font-medium text-zinc-300">
                  Drop EPUB, PDF, or text file here
                </span>
                <span className="text-[11px] text-zinc-500 mt-0.5">
                  Extracted locally in memory • Never uploaded to any server
                </span>
              </>
            )}
          </label>
        </div>

        {/* Voice Selector & Chapter Audio Actions */}
        <div className="border border-zinc-800 bg-zinc-950/60 rounded-xl p-4 flex flex-col justify-between gap-3">
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

          {/* Chapter Audio: Cache & MP3 Export */}
          {chunks.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  {epubBook ? 'Chapter Audio' : 'Document Audio'}
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {chapterCachedCount} / {activeChapterChunkIndices.length} (
                  {Math.round(
                    (chapterCachedCount / (activeChapterChunkIndices.length || 1)) * 100
                  )}
                  %)
                </span>
              </div>

              {/* Action Buttons: Cache Chapter & Download MP3 */}
              <div className="flex items-center gap-2">
                {cachingProgress?.isCaching ? (
                  <button
                    onClick={cancelCaching}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-red-400" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => cacheChapter(activeChapterChunkIndices)}
                    disabled={exportProgress?.isExporting || isSynthesizing}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {chapterCachedCount === activeChapterChunkIndices.length &&
                    activeChapterChunkIndices.length > 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cached</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Cache Chapter</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => downloadChapterMp3(activeChapterTitle, activeChapterChunkIndices)}
                  disabled={exportProgress?.isExporting || cachingProgress?.isCaching}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-950/60 hover:bg-purple-900/70 border border-purple-800/70 text-purple-200 hover:text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {exportProgress?.isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                      <span>{exportProgress.percent}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-purple-300" />
                      <span>Download MP3</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Caching Progress Bar */}
              {cachingProgress?.isCaching && (
                <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      Chunk {cachingProgress.current} / {cachingProgress.total}
                    </span>
                    <span className="font-mono text-purple-300 font-semibold">
                      {cachingProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-200 ease-out"
                      style={{ width: `${cachingProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>
                      {cachingProgress.speedSec
                        ? `${cachingProgress.speedSec.toFixed(1)}s / chunk`
                        : 'Starting...'}
                    </span>
                    <span>{cachingProgress.etaSec != null ? `~${cachingProgress.etaSec}s left` : ''}</span>
                  </div>
                </div>
              )}

              {/* Live MP3 Export Progress Bar */}
              {exportProgress?.isExporting && (
                <div className="w-full bg-zinc-900/90 border border-purple-900/50 rounded-lg p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] text-purple-200">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      Encoding MP3: {exportProgress.current} / {exportProgress.total}
                    </span>
                    <span className="font-mono text-purple-300 font-semibold">
                      {exportProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-200 ease-out"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
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
                onToggleBookmark={(idx, text) =>
                  toggleBookmark(
                    idx,
                    text,
                    activeChapterIndex,
                    chunks[idx]?.pageNumber
                  )
                }
              />
            </div>
          )}

          {/* Bookmarks Drawer Modal */}
          {isBookmarksDrawerOpen && (
            <div className="absolute inset-y-0 right-0 w-80 bg-zinc-900/95 border-l border-zinc-800 shadow-2xl backdrop-blur-md p-4 flex flex-col z-20 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
                  <Bookmark className="w-4 h-4 text-purple-400" />
                  <span>Bookmarks ({bookmarks.length})</span>
                </div>
                <button
                  onClick={() => setBookmarksDrawerOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    No bookmarks saved yet. Click the bookmark icon on any sentence to save it here.
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
