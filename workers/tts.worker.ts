import { KokoroTTS } from 'kokoro-js';

export type WorkerInMessage =
  | { type: 'PING' }
  | { type: 'INIT'; payload?: { voice?: string } }
  | { type: 'SYNTHESIZE'; id: string; payload: { text: string; voice?: string; speed?: number } };

export type WorkerOutMessage =
  | { type: 'PONG'; timestamp: number }
  | { type: 'STATUS'; payload: { status: 'idle' | 'loading' | 'ready' | 'error'; message?: string } }
  | { type: 'PROGRESS'; payload: { progress: number; message: string; file?: string } }
  | { type: 'AUDIO_READY'; id: string; payload: { audioBlobUrl: string; audioBlob?: Blob; duration?: number } }
  | { type: 'ERROR'; id?: string; payload: { message: string } };

let ttsInstance: KokoroTTS | null = null;
let isInitializing = false;

async function getOrInitTTS(): Promise<KokoroTTS> {
  if (ttsInstance) return ttsInstance;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (ttsInstance) return ttsInstance;
  }

  isInitializing = true;
  self.postMessage({
    type: 'STATUS',
    payload: { status: 'loading', message: 'Loading Kokoro neural model (WASM/q8)...' },
  } satisfies WorkerOutMessage);

  try {
    // Force WASM with q8 quantization.
    // WebGPU in onnxruntime-web has a known ConvTranspose vocoder upsampling bug in Kokoro-82M
    // that outputs explosive amplitude peaks (~1e7), sounding like loud static/white noise.
    // WASM (CPU) computes the math correctly and produces crystal-clear neural audio.
    const device = 'wasm';
    const dtype = 'q8';

    const model_id = 'onnx-community/Kokoro-82M-v1.0-ONNX';

    ttsInstance = await KokoroTTS.from_pretrained(model_id, {
      dtype,
      device,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress' || progress.status === 'download') {
          const percent = progress.progress != null ? Math.round(progress.progress) : 0;
          self.postMessage({
            type: 'PROGRESS',
            payload: {
              progress: percent,
              message: `Loading ${progress.file || 'model weights'}...`,
              file: progress.file,
            },
          } satisfies WorkerOutMessage);
        }
      },
    });

    self.postMessage({
      type: 'STATUS',
      payload: { status: 'ready', message: `Neural engine ready (${device.toUpperCase()})` },
    } satisfies WorkerOutMessage);

    return ttsInstance;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Kokoro neural engine';
    self.postMessage({
      type: 'STATUS',
      payload: { status: 'error', message: errorMsg },
    } satisfies WorkerOutMessage);
    throw err;
  } finally {
    isInitializing = false;
  }
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (!msg) return;

  switch (msg.type) {
    case 'PING':
      self.postMessage({ type: 'PONG', timestamp: Date.now() } satisfies WorkerOutMessage);
      break;

    case 'INIT':
      try {
        await getOrInitTTS();
      } catch (err) {
        console.error('[tts.worker] Init error:', err);
      }
      break;

    case 'SYNTHESIZE': {
      const { id, payload } = msg;
      try {
        const text = payload.text?.trim();
        if (!text) {
          self.postMessage({
            type: 'AUDIO_READY',
            id,
            payload: { audioBlobUrl: '', duration: 0 },
          } satisfies WorkerOutMessage);
          return;
        }

        const tts = await getOrInitTTS();
        const voice = payload.voice || 'af_heart';
        const speed = payload.speed || 1.0;

        const rawAudio = await tts.generate(text, {
          voice: voice as any,
          speed,
        });

        // Defensive clamp against audio clipping / NaN
        if (rawAudio.audio) {
          for (let i = 0; i < rawAudio.audio.length; i++) {
            const s = rawAudio.audio[i];
            if (Number.isNaN(s)) {
              rawAudio.audio[i] = 0;
            } else if (s > 1) {
              rawAudio.audio[i] = 1;
            } else if (s < -1) {
              rawAudio.audio[i] = -1;
            }
          }
        }

        const blob = rawAudio.toBlob();
        const audioBlobUrl = URL.createObjectURL(blob);
        const duration = rawAudio.audio ? rawAudio.audio.length / rawAudio.sampling_rate : 0;

        self.postMessage({
          type: 'AUDIO_READY',
          id,
          payload: { audioBlobUrl, audioBlob: blob, duration },
        } satisfies WorkerOutMessage);
      } catch (err) {
        self.postMessage({
          type: 'ERROR',
          id,
          payload: { message: err instanceof Error ? err.message : 'Speech synthesis failed' },
        } satisfies WorkerOutMessage);
      }
      break;
    }

    default:
      console.warn('[tts.worker] Unrecognized command:', msg);
  }
};
