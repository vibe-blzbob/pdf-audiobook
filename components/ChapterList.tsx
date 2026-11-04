import React from 'react';
import type { EpubChapter } from '@/lib/epub';
import { BookOpen, ChevronRight, X } from 'lucide-react';

interface ChapterListProps {
  chapters: EpubChapter[];
  activeChapterIndex: number;
  isOpen: boolean;
  onSelectChapter: (index: number) => void;
  onClose: () => void;
}

export const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  activeChapterIndex,
  isOpen,
  onSelectChapter,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="relative w-full max-w-sm bg-gray-900 border-r border-gray-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-100">Table of Contents</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chapters list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter, idx) => {
            const isActive = idx === activeChapterIndex;
            return (
              <button
                key={chapter.id || idx}
                onClick={() => {
                  onSelectChapter(idx);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-xs transition-colors ${
                  isActive
                    ? 'bg-purple-950/60 text-purple-200 border border-purple-800/60 font-semibold'
                    : 'text-gray-300 hover:bg-gray-800/70 hover:text-gray-100'
                }`}
              >
                <div className="truncate pr-2">
                  <span className="text-[10px] text-gray-500 mr-2">#{idx + 1}</span>
                  <span>{chapter.title}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-500">{chapter.chunks.length} lines</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-gray-600'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  );
};

