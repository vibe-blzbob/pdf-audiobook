import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedBookmark {
  id: string;
  chunkIndex: number;
  chapterIndex?: number;
  pageNumber?: number;
  text: string;
  createdAt: number;
}

interface AudiobookStoreState {
  bookmarks: SavedBookmark[];
  selectedVoice: string;
  activeChapterIndex: number;
  isBookmarksDrawerOpen: boolean;
  isChapterListOpen: boolean;
  setSelectedVoice: (voice: string) => void;
  setActiveChapterIndex: (index: number) => void;
  toggleBookmarksDrawer: () => void;
  setBookmarksDrawerOpen: (open: boolean) => void;
  toggleChapterList: () => void;
  setChapterListOpen: (open: boolean) => void;
  toggleBookmark: (
    chunkIndex: number,
    text: string,
    chapterIndex?: number,
    pageNumber?: number
  ) => void;
  removeBookmark: (id: string) => void;
}

export const useAudiobookStore = create<AudiobookStoreState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      selectedVoice: 'af_heart',
      activeChapterIndex: 0,
      isBookmarksDrawerOpen: false,
      isChapterListOpen: false,

      setSelectedVoice: (voice) => set({ selectedVoice: voice }),
      setActiveChapterIndex: (index) => set({ activeChapterIndex: index }),

      toggleBookmarksDrawer: () =>
        set((state) => ({
          isBookmarksDrawerOpen: !state.isBookmarksDrawerOpen,
        })),

      setBookmarksDrawerOpen: (open) => set({ isBookmarksDrawerOpen: open }),

      toggleChapterList: () =>
        set((state) => ({
          isChapterListOpen: !state.isChapterListOpen,
        })),

      setChapterListOpen: (open) => set({ isChapterListOpen: open }),

      toggleBookmark: (chunkIndex, text, chapterIndex = 0, pageNumber) => {
        const { bookmarks } = get();
        const existing = bookmarks.find((b) => b.chunkIndex === chunkIndex);

        if (existing) {
          set({ bookmarks: bookmarks.filter((b) => b.chunkIndex !== chunkIndex) });
        } else {
          const newBookmark: SavedBookmark = {
            id: crypto.randomUUID(),
            chunkIndex,
            chapterIndex,
            pageNumber,
            text: text.slice(0, 120) + (text.length > 120 ? '...' : ''),
            createdAt: Date.now(),
          };
          set({ bookmarks: [...bookmarks, newBookmark] });
        }
      },

      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),
    }),
    {
      name: 'scribe-audiobook-storage',
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        selectedVoice: state.selectedVoice,
        activeChapterIndex: state.activeChapterIndex,
      }),
    }
  )
);
