# Intent: Chapter Audio Caching and MP3 Export

## Confirmed Intent
- **Outcome:** Chapter-level persistent audio caching in IndexedDB and chapter MP3 export, with dedicated progress bars and a real-time resource monitor (RAM usage, IndexedDB storage, and synthesis throughput).
- **User:** Listener wanting seamless, gapless playback in-app, portable MP3 downloads, and clear visibility into device memory and storage during synthesis.
- **Why now:** Kokoro neural synthesis on CPU is resource-heavy; pre-caching avoids playback stutter, and users need real-time feedback on progress and hardware resource consumption.
- **Success:**
  1. A "Cache Chapter" button with a real-time progress bar that persists audio chunks in IndexedDB so listening is gapless and survives reloads.
  2. A "Download Chapter MP3" button with an encoding progress bar that stitches the chapter's audio into a single `.mp3` file.
  3. A resource monitor displaying active RAM/JS heap usage, IndexedDB storage consumption, and synthesis processing speed.
- **Constraint:** 100% offline client-side execution; uses standard browser metrics (`performance.memory`, `navigator.storage.estimate()`) since browser sandboxes restrict raw host CPU% reading.
- **Out of scope:** Full-book single-file export (scoped chapter-by-chapter); server-side transcoding.

## Implementation Architecture
1. **Persistent Cache (`lib/audioCache.ts`)**:
   - Stores synthesized audio blobs in an IndexedDB database (`pdf-audiobook-audio-cache`) via `idb-keyval`.
   - Keys: `${bookName}::chunk_${chunkIndex}::${voice}`.
   - Provides chapter-level cache status query and storage estimation (`navigator.storage.estimate()`).
2. **MP3 Encoder (`lib/mp3Encoder.ts`)**:
   - Client-side audio decoder (`AudioContext.decodeAudioData`) to convert WAV blobs to Float32 PCM.
   - Converts to Int16 with 250ms sentence pauses and encodes to MP3 using `@breezystack/lamejs`.
   - Reports encoding progress (0-100%) and triggers file download.
3. **Resource Monitor (`hooks/useResourceMonitor.ts`)**:
   - Real-time polling of Chromium JS heap (`performance.memory`), IndexedDB storage (`navigator.storage.estimate()`), and rolling synthesis throughput (seconds per sentence).
4. **Player Integration (`hooks/usePremiumAudiobookPlayer.ts`)**:
   - Checks IndexedDB before requesting worker synthesis, eliminating duplicate work and enabling instant gapless playback.
   - Stores new worker outputs directly into IndexedDB.
   - Provides `cacheChapter` and `downloadChapterMp3` functions with abort handling.
5. **UI Surface (`app/page.tsx` & `components/ResourceMonitor.tsx`)**:
   - "Cache Chapter" button with chunk progress bar, ETA, and stop button.
   - "Download MP3" button with conversion progress bar.
   - Resource status monitor displaying live RAM, Cache storage, and TTS speed.

