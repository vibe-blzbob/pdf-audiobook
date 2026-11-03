"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Bookmark, Play, BookOpen } from "lucide-react";
import { DocumentChunk } from "@/lib/pdf";

interface TextReaderProps {
  chunks: DocumentChunk[];
  currentIndex: number;
  bookmarkedChunkIndices: Set<number>;
  onSelectChunk: (index: number) => void;
  onToggleBookmark: (chunkIndex: number, text: string, pageNumber: number) => void;
}

export function TextReader({
  chunks,
  currentIndex,
  bookmarkedChunkIndices,
  onSelectChunk,
  onToggleBookmark,
}: TextReaderProps) {
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selectedRange, setSelectedRange] = useState<{
    text: string;
    chunkIndex: number;
    pageNumber: number;
    x: number;
    y: number;
  } | null>(null);

  // Group sentences by paragraph and page
  const paragraphs = useMemo(() => {
    if (!chunks.length) return [];

    interface ParagraphGroup {
      paragraphIndex: number;
      pageNumber: number;
      chunks: DocumentChunk[];
    }

    const groups: ParagraphGroup[] = [];
    let currentGroup: ParagraphGroup | null = null;

    chunks.forEach((chunk) => {
      const pIdx = chunk.paragraphIndex ?? 0;
      if (
        !currentGroup ||
        currentGroup.paragraphIndex !== pIdx ||
        currentGroup.pageNumber !== chunk.pageNumber
      ) {
        currentGroup = {
          paragraphIndex: pIdx,
          pageNumber: chunk.pageNumber,
          chunks: [chunk],
        };
        groups.push(currentGroup);
      } else {
        currentGroup.chunks.push(chunk);
      }
    });

    return groups;
  }, [chunks]);

  // Keep active sentence line centered smoothly in view
  useEffect(() => {
    const el = lineRefs.current.get(currentIndex);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectedRange(null);
      return;
    }

    const text = selection.toString().trim();
    const anchorNode = selection.anchorNode;
    const parentEl = anchorNode?.parentElement?.closest("[data-chunk-idx]");
    if (parentEl) {
      const cIdx = parseInt(parentEl.getAttribute("data-chunk-idx") || "0", 10);
      const pageNum = chunks[cIdx]?.pageNumber || 1;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectedRange({
        text,
        chunkIndex: cIdx,
        pageNumber: pageNum,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    }
  };

  if (!chunks || !chunks.length) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-zinc-500">
        Upload a PDF or document to view text
      </div>
    );
  }

  return (
    <div
      onMouseUp={handleMouseUp}
      className="relative h-[65vh] overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-8 shadow-2xl backdrop-blur-md"
    >
      {/* Floating Action Menu for Selected Text */}
      {selectedRange && (
        <div
          style={{ top: `${selectedRange.y}px`, left: `${selectedRange.x}px` }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl text-xs font-medium animate-in fade-in"
        >
          <button
            onClick={() => {
              onSelectChunk(selectedRange.chunkIndex);
              setSelectedRange(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Play from line
          </button>
          <button
            onClick={() => {
              onToggleBookmark(
                selectedRange.chunkIndex,
                selectedRange.text,
                selectedRange.pageNumber
              );
              setSelectedRange(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 transition"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Bookmark
          </button>
        </div>
      )}

      {/* Paragraphs separated by mb-5, justified indentation, no spaces between sentence lines */}
      <div className="mx-auto max-w-3xl text-zinc-300">
        {paragraphs.map((para, pIdx) => {
          const isFirstParaOfPage =
            pIdx === 0 || paragraphs[pIdx - 1]?.pageNumber !== para.pageNumber;

          return (
            <div key={`para-${para.pageNumber}-${para.paragraphIndex}`}>
              {isFirstParaOfPage && (
                <div
                  id={`page-section-${para.pageNumber}`}
                  className="flex items-center gap-2 my-4 pt-3 border-t border-zinc-800/60 first:border-none first:my-0 first:pt-0"
                >
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-amber-400/90">
                    <BookOpen className="w-3 h-3" />
                    PAGE {para.pageNumber}
                  </span>
                  <div className="h-px flex-1 bg-zinc-800/40" />
                </div>
              )}

              {/* Paragraph block: justified text with separated margin mb-5 */}
              <div className="mb-5 text-justify">
                {para.chunks.map((chunk, cIdx) => {
                  const isActive = chunk.index === currentIndex;
                  const isBookmarked = bookmarkedChunkIndices.has(chunk.index);
                  const isFirstSentence = cIdx === 0;

                  return (
                    <div
                      key={chunk.index}
                      data-chunk-idx={chunk.index}
                      ref={(el) => {
                        if (el) lineRefs.current.set(chunk.index, el);
                        else lineRefs.current.delete(chunk.index);
                      }}
                      onClick={() => onSelectChunk(chunk.index)}
                      className={`block my-0 py-0 leading-normal cursor-pointer rounded-sm px-1 transition-colors ${
                        isFirstSentence ? "indent-6 sm:indent-8" : "indent-0"
                      } ${
                        isActive
                          ? "bg-amber-500/20 text-amber-200 font-medium ring-1 ring-amber-500/40"
                          : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                      }`}
                      title="Click to play from this sentence"
                    >
                      {isBookmarked && (
                        <Bookmark className="inline-block w-3.5 h-3.5 text-amber-400 fill-amber-400 mr-1.5 align-middle" />
                      )}
                      <span>{chunk.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
