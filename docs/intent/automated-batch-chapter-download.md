# Intent: Automated Batch Chapter Download & Memory Management

## Confirmed Intent
- **Outcome:** An automated batch queue that synthesizes, encodes, and downloads chapters sequentially, with options for **"All Chapters"** or **"From Current Onward"**, auto-purging RAM and cache after each chapter to prevent tab crashes.
- **User:** Audiobook listener who wants to export an entire book hands-free as a series of chapter MP3s without babysitting each chapter or exhausting browser memory.
- **Why now:** Manually clicking "Cache" and "Download" for dozens of individual chapters is tedious, and retaining multiple chapters in memory risks browser tab crashes.
- **Success:**
  1. User can choose between **"Queue All Chapters"** (from Chapter 1) or **"Queue From Current"** (from the active chapter onward).
  2. The queue displays overall macro progress (`Chapter X of Y`) alongside live sentence synthesis and MP3 encoding progress.
  3. After each chapter triggers download, all its audio chunks in IndexedDB and in-memory object URLs are immediately purged, and memory is yielded before the next chapter begins.
  4. A **"Stop Queue"** button allows aborting the process at any time without data loss.
- **Constraint:** 100% client-side offline execution; strictly sequential processing (one chapter at a time) to keep RAM usage minimal.
- **Out of scope:** Merging all chapters into one multi-gigabyte file (remains chapter-by-chapter files); running while the browser tab is closed.

