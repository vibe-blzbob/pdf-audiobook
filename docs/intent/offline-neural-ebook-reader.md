# Statement of Intent: Offline Neural EPUB Reader

- **Outcome:** A lightweight, 100% client-side offline neural ebook reader (Vite SPA / PWA) tailored for EPUBs.
- **User:** Personal listening for anyone wanting natural human-quality audiobook narration without subscriptions or API keys.
- **Why now:** Cloud APIs (OpenAI) cost money and fail offline, legacy browser speech sounds robotic, and PDFs produce awkward narration compared to clean EPUB chapter text.
- **Success:** Drop in an `.epub` file, select an offline neural voice (Kokoro-js via WebGPU/WASM), and listen with sentence-level karaoke sync and chapter navigation with zero network requests once cached.
- **Constraint:** 100% free, runs entirely client-side in-browser, no backend server or Node runtime required.
- **Out of scope:** Cloud TTS APIs (OpenAI/ElevenLabs), server-side databases, complex PDF layout parsing, and DRM-protected files.

