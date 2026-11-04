# 🎧 Offline Neural Ebook Reader (PWA)

A 100% client-side, offline neural ebook and audiobook reader built with **Vite**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Kokoro TTS (ONNX Runtime Web / WebGPU)**.

Transforms EPUBs, PDFs, and text documents into spoken audiobooks using state-of-the-art **neural voices completely offline** inside the browser with zero cloud API keys, zero subscriptions, and zero backend servers.

---

## ✨ Features

### 📖 Native EPUB & Document Ingestion
- **Primarily EPUBs:** Parses standard `.epub` books, extracts the Table of Contents, chapter navigation, and clean semantic text without layout clutter.
- **PDF & Plain Text Support:** Also supports `.pdf`, `.md`, and `.txt` files with automated page/sentence reconstruction.
- **Sentence Segmentation:** Uses ECMAScript standard `Intl.Segmenter` to split chapters into natural spoken sentences.

### 🎙️ 100% Offline Neural Speech Synthesis
- **Kokoro-js (82M ONNX Model):** Runs locally via WebGPU (with WebAssembly fallback). Produces studio-grade natural human speech.
- **50+ Pre-Packaged Neural Voices:** Includes top-rated voices like `Heart (American Female)`, `Bella`, `Nicole`, `Adam (American Male)`, `Emma (British Female)`, and `George (British Male)`.
- **Zero API Costs:** No OpenAI, ElevenLabs, or monthly credits required.
- **Dual-Deck Gapless Playback:** Alternates between audio decks with lookahead pre-synthesis and natural breathing pauses (250ms) between sentences.
- **Web Speech Fallback:** Instant fallback to browser-installed system voices if WebGPU/WASM is unavailable.

### ⚡ Offline PWA & Library Persistence
- **Progressive Web App (PWA):** Installs directly to desktop or mobile via `vite-plugin-pwa` with full Service Worker caching.
- **Persistent Reading State:** Automatically preserves your active book, chapter, and reading position across sessions in IndexedDB (`idb-keyval`).
- **Karaoke Sentence Tracking:** Synchronized text highlighting with auto-centering and click-to-speak sentence jumping.
- **Bookmarks Drawer:** Save sentences or chapters and jump back anytime.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Neural TTS Engine** | [Kokoro-js](https://github.com/hexgrad/kokoro) (ONNX Runtime Web / WebGPU) |
| **Background ML Worker** | Native Web Worker (`workers/tts.worker.ts`) |
| **EPUB Processing** | [JSZip](https://stuk.github.io/jszip/) + Native Browser DOMParser |
| **PDF Processing** | [PDF.js (`pdfjs-dist`)](https://mozilla.github.io/pdf.js/) |
| **State & Storage** | [Zustand](https://github.com/pmndrs/zustand) + [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB) |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## 📁 Project Structure

```text
pdf-audiobook/
├── components/
│   ├── ChapterList.tsx           # Table of Contents modal and chapter selector
│   ├── ModelStatusBanner.tsx     # Kokoro download & offline readiness badge
│   └── TextReader.tsx            # Sentence-by-sentence karaoke text view
├── hooks/
│   └── usePremiumAudiobookPlayer.ts # Dual-deck gapless audio player hooked to Kokoro worker
├── lib/
│   ├── epub.ts                   # Client-side EPUB parser & sentence segmenter
│   ├── pdf.ts                    # PDF.js text extraction
│   ├── storage.ts                # IndexedDB persistence (idb-keyval) for book & position
│   ├── voices.ts                 # Kokoro voice options & metadata
│   └── workerClient.ts           # Typed RPC client communicating with tts.worker
├── workers/
│   └── tts.worker.ts             # Dedicated Web Worker hosting Kokoro ONNX model
├── store/
│   └── useAudiobookStore.ts      # Zustand store for voice preference & bookmarks
├── app/
│   ├── globals.css               # Tailwind CSS v4 setup
│   └── page.tsx                  # Main reader shell, player toolbar & dropzone
├── index.html                    # Root HTML shell
├── vite.config.ts                # Vite & PWA Service Worker configuration
└── package.json
```

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Modern Browser**: Chrome, Edge, Brave, Firefox, or Safari (WebGPU recommended for fastest neural synthesis)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pdf-audiobook
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## 💻 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite local development server at `http://localhost:3000` |
| `npm run build` | Compiles TypeScript and creates optimized PWA production bundle in `dist/` |
| `npm run preview` | Previews the production build locally with full Service Worker caching |

---

## 🎧 How It Works

1. **Launch the App:** Run `npm run dev` or open the installed PWA.
2. **First-Time Model Cache:** Kokoro's quantized model (~80MB) downloads once on first launch and is permanently stored in browser cache.
3. **Load an Ebook:** Drop any `.epub` file into the reader. The Table of Contents and chapters are parsed instantly.
4. **Select a Voice & Play:** Pick from human-grade neural voices like **Heart**, **Bella**, **Adam**, or **Emma**, press Play, and enjoy seamless offline narration.

---

## 📄 License

Internal use / Private repository. All rights reserved.
