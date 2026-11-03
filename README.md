# 🎧 PDF Audiobook (Scribe)

A modern, accessible document-to-audiobook web application built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Zustand**. 

Transforms PDFs, Markdown files, and text documents into spoken audiobooks with sentence-level karaoke highlighting, dual-deck gapless playback, and support for both neural cloud TTS and offline browser speech synthesis.

---

## ✨ Features

### 📄 Smart Document Ingestion & Parsing
- **Multi-Format Support:** Reads `.pdf`, `.md`, `.markdown`, and `.txt` documents.
- **Structured PDF Extraction:** Powered by `pdfjs-dist` to reconstruct paragraphs, vertical layout bounds, and page groupings.
- **Intelligent Sentence Segmentation:** Uses the ECMAScript `Intl.Segmenter` API (with regex fallback) to split text cleanly into individual spoken units without breaking abbreviations or numbers.

### 🎙️ Dual-Engine Audio Architecture
- **Cloud Neural TTS (OpenAI):** Supports high-fidelity OpenAI `tts-1` voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) via `/api/tts` with caching.
- **Zero-Config Browser Speech Fallback:** Automatically falls back to the native Web Speech API (`speechSynthesis`) if no API key is configured or when running offline.
- **Dual-Deck Gapless Playback Engine:** Utilizes two alternating HTML5 audio elements (`Deck A` and `Deck B`) and lookahead pre-fetching so subsequent sentences start seamlessly with zero buffering latency.
- **Natural Pacing:** Inserts a subtle natural breathing pause (250ms) between sentences for comfortable long-form listening.
- **Full Document Pre-Synthesis:** Option to batch pre-synthesize the entire document with live progress indicators.

### 📖 Synchronized Text Reader UI
- **Karaoke Sentence Highlighting:** Active sentences are dynamically highlighted in real-time as they are spoken.
- **Auto-Scroll Tracking:** Smoothly centers the currently spoken sentence in view while reading.
- **Click-to-Speak:** Click any sentence in the reader or highlight a snippet to immediately jump audio playback to that position.
- **Page Jump Navigation:** Jump directly to any page with automatic audio re-anchoring.

### 🔖 Bookmarks & Annotation System
- **Sentence & Selection Bookmarks:** Save key sentences or highlighted text segments with exact page numbers and timestamps.
- **Slide-Out Bookmarks Drawer:** Browse, jump to, and delete saved bookmarks at any time.
- **Persistent Storage:** Bookmarks and voice preferences automatically persist across sessions via Zustand's `localStorage` middleware.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Frontend** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) with Turbopack |
| **PDF Processing** | [PDF.js (`pdfjs-dist`)](https://mozilla.github.io/pdf.js/) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) (with `persist` middleware) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Speech Engine** | OpenAI Audio API (`tts-1`) + Native Web Speech API (`SpeechSynthesis`) |

---

## 📁 Project Structure

```text
pdf-audiobook/
├── app/
│   ├── api/
│   │   └── tts/
│   │       └── route.ts               # Server-side OpenAI TTS proxy & audio stream response
│   ├── favicon.ico
│   ├── globals.css                    # Tailwind CSS v4 imports
│   ├── layout.tsx                     # Root HTML & body shell
│   └── page.tsx                       # Main application view & playback toolbar
├── components/
│   └── TextReader.tsx                 # Paragraph grouping, sentence viewer & karaoke highlighter
├── hooks/
│   └── usePremiumAudiobookPlayer.ts   # Dual-deck gapless audio player & synthesis queue hook
├── lib/
│   └── pdf.ts                         # Document extraction, sentence segmentation & progress callbacks
├── store/
│   └── useAudiobookStore.ts           # Zustand store for bookmarks, drawer state & voice settings
├── public/                            # Static assets
├── package.json
└── tsconfig.json
```

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js**: v18.17+ or v20+
- **Package Manager**: `npm`, `pnpm`, or `yarn`

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

3. *(Optional)* Configure OpenAI TTS for premium voices:
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=sk-...
   ```
   > **Note:** If `OPENAI_API_KEY` is not provided, the application automatically uses free, built-in browser speech voices with zero setup required.

---

## 💻 Development & Production Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with Turbopack at `http://localhost:3000` |
| `npm run build` | Compiles optimized production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs Next.js ESLint checks |

---

## 🎧 How It Works

1. **Upload Document:**
   - Drop or browse any `.pdf`, `.md`, or `.txt` file into the upload zone.
   - The file is parsed into page-indexed sentences with live percentage progress.

2. **Select Voice:**
   - Choose from OpenAI neural voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) or browser voices from the voice selector.

3. **Listen & Follow Along:**
   - Press **Play** or click any sentence to start listening.
   - The document automatically scrolls and highlights each sentence in sync with the audio.

4. **Bookmark & Annotate:**
   - Click the bookmark icon on any sentence or highlight text to save it to your bookmarks drawer.
   - Open the bookmarks drawer anytime to jump back to previously saved points.

---

## 📄 License

Internal use / Private repository. All rights reserved.
