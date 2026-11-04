# Implementation Plan: Offline Neural EPUB Reader

## Overview
Restructure `pdf-audiobook` from a server-dependent Next.js app into a 100% client-side, offline-capable Vite + React SPA / PWA. It extracts text and chapters from EPUB files and generates natural human-grade speech directly in the browser using Kokoro-js (ONNX Runtime Web / WebGPU) with zero server, zero cloud API fees, and persistent offline caching.

## Architecture Decisions
1. **Vite SPA over Next.js:** Eliminates Node server requirements and dead-weight SSR. Produces a static bundle deployable anywhere or usable locally/offline.
2. **Web Worker for Kokoro-js:** Neural inference (WebGPU / WASM) runs in a background Web Worker so the main UI thread never stutters or drops frames during speech synthesis.
3. **Model Weight Caching (IndexedDB/CacheStorage):** Kokoro's 82M model (~80MB) is fetched once and cached permanently on device for true offline operation.
4. **Client-Side EPUB Parsing:** Extract chapters and text blocks client-side, segmenting sentences with standard `Intl.Segmenter`.
5. **Dual-Deck Gapless Playback:** Retain lookahead pre-synthesis and alternating audio buffers to ensure zero pause between sentences.

---

## Task List

### Phase 1: Client Foundation & Vite Restructure
- [ ] **Task 1:** Migrate project build setup from Next.js to Vite + React + TypeScript + Tailwind CSS.
- [ ] **Task 2:** Establish background Web Worker scaffold with typed RPC messaging for TTS tasks.

### Checkpoint: Foundation
- [ ] Clean Vite build (`npm run build`) with zero server routes.
- [ ] UI shell loads with working Worker message loop.

### Phase 2: Offline Neural TTS Engine (Kokoro-js)
- [ ] **Task 3:** Integrate Kokoro-js / ONNX Runtime Web inside the Web Worker with WebGPU provider & WASM fallback.
- [ ] **Task 4:** Add model download progress tracking and IndexedDB/CacheStorage offline persistence.

### Checkpoint: Neural Speech
- [ ] Worker successfully synthesizes a sample sentence into an audio buffer with zero cloud API keys.
- [ ] Second synthesis works with network disconnected.

### Phase 3: EPUB Parser & Text Segmentation
- [ ] **Task 5:** Implement client-side EPUB file loader with Table of Contents (TOC) and chapter extraction.
- [ ] **Task 6:** Segment chapter text into sentences via `Intl.Segmenter` with paragraph/chapter index mappings.

### Checkpoint: EPUB Reading
- [ ] Drop an `.epub` file, view chapter list, and read formatted chapter text.

### Phase 4: Audio Player Integration & Karaoke Sync
- [ ] **Task 7:** Connect dual-deck player hook to Kokoro Web Worker with lookahead pre-synthesis.
- [ ] **Task 8:** Synchronize reader UI: active sentence auto-centering, karaoke highlighting, and click-to-speak.

### Checkpoint: End-to-End Narration
- [ ] Listen to an EPUB chapter with continuous, gapless speech and real-time sentence tracking.

### Phase 5: Library Persistence & PWA Offline Setup
- [ ] **Task 9:** Persist reading position, current book, and bookmarks across sessions via Zustand + IndexedDB.
- [ ] **Task 10:** Configure PWA Service Worker via `vite-plugin-pwa` for 100% offline app loading.

### Checkpoint: Complete
- [ ] App launches and narrates books completely disconnected from the internet.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Device without WebGPU** | Medium (slower CPU inference) | Automatically fallback to ONNX WebAssembly (WASM) multithreaded backend. |
| **Initial 80MB Model Download** | Medium (network delay on first load) | Show explicit progress bar and explanation; cache permanently in CacheStorage/IndexedDB. |
| **Mobile Browser Memory Constraints** | Low | Synthesize 1-2 sentences ahead instead of whole chapters at once. |
| **Malformed EPUB Files** | Low | Sanitize HTML chapter strings with standard browser DOMParser. |

