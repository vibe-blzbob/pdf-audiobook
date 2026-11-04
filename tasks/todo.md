# Task List: Offline Neural EPUB Reader

## Phase 1: Client Foundation & Vite Restructure

### Task 1: Migrate build setup from Next.js to Vite + React + TypeScript
**Description:** Replace Next.js config and App Router files with a lean Vite SPA configuration using React 19, TypeScript, and Tailwind CSS.
**Acceptance criteria:**
- [x] `vite.config.ts` and `index.html` configured.
- [x] Next.js dependencies and `/api/tts` route removed from `package.json`.
- [x] `npm run dev` and `npm run build` execute without errors.
**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Dev server runs: `npm run dev`
**Dependencies:** None
**Files likely touched:**
- `package.json`
- `vite.config.ts`
- `index.html`
- `src/App.tsx`
- `src/main.tsx`
**Estimated scope:** Medium (3-5 files)

---

### Task 2: Background Web Worker Scaffold & RPC
**Description:** Create a dedicated Web Worker to host heavy ML inference tasks off the main UI thread.
**Acceptance criteria:**
- [x] Web Worker initialized via Vite worker loader (`new Worker(new URL(...))`).
- [x] Typed message protocol defined (`INIT`, `SYNTHESIZE`, `PROGRESS`, `AUDIO_READY`, `ERROR`).
- [x] Main thread can send a ping and receive a pong without blocking UI.
**Verification:**
- [x] Console logs verify bidirectional communication between main thread and worker.
**Dependencies:** Task 1
**Files likely touched:**
- `src/workers/tts.worker.ts`
- `src/lib/workerClient.ts`
**Estimated scope:** Small (1-2 files)

---

## Checkpoint 1: Foundation Check
- [x] Vite build succeeds cleanly with zero Node server requirements.
- [x] Worker thread communicates smoothly with main React UI thread.

---

## Phase 2: Offline Neural TTS Engine (Kokoro-js)

### Task 3: Integrate Kokoro-js / ONNX Runtime Web in Worker
**Description:** Implement local neural speech synthesis in `tts.worker.ts` using `kokoro-js` with WebGPU support and WASM fallback.
**Acceptance criteria:**
- [x] `kokoro-js` loaded in worker.
- [x] Synthesis handler converts input text into raw PCM/WAV audio blob.
- [x] Supports selecting standard Kokoro voices (e.g. `af_heart`, `am_adam`, `bf_emma`).
**Verification:**
- [x] Trigger test synthesis: audio element plays synthesized speech clearly.
**Dependencies:** Task 2
**Files likely touched:**
- `src/workers/tts.worker.ts`
- `src/lib/workerClient.ts`
**Estimated scope:** Small (2 files)

---

### Task 4: Model Download Progress & Offline Cache
**Description:** Add visual progress tracking during initial model download and verify permanent IndexedDB/CacheStorage caching.
**Acceptance criteria:**
- [x] Model download reports percentage progress to the UI.
- [x] Once downloaded, turning off internet connection allows full speech synthesis without errors.
**Verification:**
- [x] Disconnect internet in browser DevTools Network tab and verify synthesis completes.
**Dependencies:** Task 3
**Files likely touched:**
- `src/workers/tts.worker.ts`
- `src/components/ModelStatusBanner.tsx`
**Estimated scope:** Small (2 files)

---

## Checkpoint 2: Neural Speech Check
- [x] High-quality offline neural speech synthesis operates with zero cloud API keys.
- [x] Works with browser set to offline mode.

---

## Phase 3: EPUB Parser & Text Segmentation

### Task 5: Client-side EPUB Ingestion & Chapter Extraction
**Description:** Add EPUB file parsing using `epubjs` to extract book metadata, table of contents, and raw chapter text.
**Acceptance criteria:**
- [x] Accepts `.epub` drag-and-drop or file upload.
- [x] Parses table of contents (TOC) with chapter titles.
- [x] Loads selected chapter content cleanly, stripping irrelevant HTML tags/styling.
**Verification:**
- [x] Upload sample `.epub` file and verify chapters render in navigation list.
**Dependencies:** Task 1
**Files likely touched:**
- `src/lib/epub.ts`
- `src/components/ChapterList.tsx`
**Estimated scope:** Medium (2-3 files)

---

### Task 6: Sentence Segmentation & Mapping
**Description:** Segment chapter text into individual sentences using `Intl.Segmenter` and index them for playback tracking.
**Acceptance criteria:**
- [x] Sentences segmented cleanly with chapter and paragraph index metadata.
- [x] Preserves common abbreviations, dialog quotes, and punctuation without awkward splits.
**Verification:**
- [x] Inspect segmented array to verify sentences match readable prose.
**Dependencies:** Task 5
**Files likely touched:**
- `src/lib/epub.ts`
- `src/components/ReaderView.tsx`
**Estimated scope:** Small (2 files)

---

## Checkpoint 3: EPUB Reading Check
- [x] EPUB uploads, displays chapters, and displays clean sentence-segmented text ready for narration.

---

## Phase 4: Audio Player Integration & Karaoke Sync

### Task 7: Dual-Deck Audio Queue with Lookahead
**Description:** Connect the dual-deck player to the Kokoro worker with lookahead synthesis (synthesize sentence N+1 while sentence N plays).
**Acceptance criteria:**
- [x] Zero audible gap between consecutive sentences.
- [x] Pausing, resuming, and seeking cancel unneeded pending worker synthesis jobs.
**Verification:**
- [x] Listen to a multi-sentence paragraph without audio hiccups.
**Dependencies:** Task 3, Task 6
**Files likely touched:**
- `src/hooks/useAudiobookPlayer.ts`
**Estimated scope:** Medium (2-3 files)

---

### Task 8: Synchronized Karaoke Reader UI
**Description:** Connect playback state to the visual reader component.
**Acceptance criteria:**
- [x] Active sentence is highlighted with smooth color transition.
- [x] Reader automatically scrolls to keep the current sentence centered on screen.
- [x] Clicking any sentence immediately seeks audio to that sentence.
**Verification:**
- [x] Verify automatic scrolling and click-to-seek during active playback.
**Dependencies:** Task 7
**Files likely touched:**
- `src/components/ReaderView.tsx`
- `src/App.tsx`
**Estimated scope:** Small (2 files)

---

## Checkpoint 4: Narration & Reading Check
- [x] Full end-to-end reading experience: audio narration with synchronized text highlighting and chapter navigation.

---

## Phase 5: Library Persistence & PWA Offline Setup

### Task 9: IndexedDB Library & Reading Progress
**Description:** Save uploaded books, reading position (chapter + sentence), and bookmarks in browser IndexedDB via Zustand.
**Acceptance criteria:**
- [x] Refreshing the browser preserves the currently open book and reading position.
- [x] Users can bookmark sentences and jump back to them.
**Verification:**
- [x] Refresh page mid-chapter and confirm position is restored.
**Dependencies:** Task 8
**Files likely touched:**
- `src/store/useReaderStore.ts`
**Estimated scope:** Small (2 files)

---

### Task 10: PWA Service Worker Configuration
**Description:** Configure `vite-plugin-pwa` so the web app assets and shell can be installed and launched offline.
**Acceptance criteria:**
- [x] Service worker caches HTML, JS, CSS, and web fonts.
- [x] App is installable as a PWA on Chrome/Edge/Mobile.
**Verification:**
- [x] Launch application with network disabled and verify full app shell loads.
**Dependencies:** Task 9
**Files likely touched:**
- `vite.config.ts`
- `src/main.tsx`
**Estimated scope:** Small (2 files)

---

## Checkpoint 5: Complete
- [x] 100% offline, neural, free EPUB reader working end-to-end.

