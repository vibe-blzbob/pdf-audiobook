import type { WorkerInMessage, WorkerOutMessage } from '@/workers/tts.worker';

export interface TTSStatus {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
}

export interface TTSProgress {
  progress: number;
  message: string;
  file?: string;
}

type StatusListener = (status: TTSStatus) => void;
type ProgressListener = (progress: TTSProgress) => void;

class TTSWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (res: any) => void; reject: (err: Error) => void }>();
  private statusListeners = new Set<StatusListener>();
  private progressListeners = new Set<ProgressListener>();
  private currentStatus: TTSStatus = { status: 'idle' };

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    try {
      this.worker = new Worker(new URL('../workers/tts.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === 'STATUS') {
          this.currentStatus = msg.payload;
          this.statusListeners.forEach((fn) => fn(msg.payload));
        } else if (msg.type === 'PROGRESS') {
          this.progressListeners.forEach((fn) => fn(msg.payload));
        } else if (msg.type === 'PONG') {
          const handler = this.pendingRequests.get('ping');
          if (handler) {
            handler.resolve(msg.timestamp);
            this.pendingRequests.delete('ping');
          }
        } else if (msg.type === 'AUDIO_READY') {
          const handler = this.pendingRequests.get(msg.id);
          if (handler) {
            handler.resolve(msg.payload);
            this.pendingRequests.delete(msg.id);
          }
        } else if (msg.type === 'ERROR') {
          if (msg.id && this.pendingRequests.has(msg.id)) {
            this.pendingRequests.get(msg.id)!.reject(new Error(msg.payload.message));
            this.pendingRequests.delete(msg.id);
          } else {
            console.error('[TTSWorkerClient] Global Worker Error:', msg.payload.message);
          }
        }
      };
    } catch (err) {
      console.error('[TTSWorkerClient] Failed to instantiate worker:', err);
    }
  }

  public async ping(): Promise<number> {
    if (!this.worker) throw new Error('Worker not available');

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('ping', { resolve, reject });
      this.worker!.postMessage({ type: 'PING' } satisfies WorkerInMessage);

      setTimeout(() => {
        if (this.pendingRequests.has('ping')) {
          this.pendingRequests.delete('ping');
          reject(new Error('Worker ping timeout'));
        }
      }, 3000);
    });
  }

  public init(voice?: string) {
    this.worker?.postMessage({ type: 'INIT', payload: { voice } } satisfies WorkerInMessage);
  }

  public async synthesize(id: string, text: string, voice = 'af_heart', speed = 1.0) {
    if (!this.worker) throw new Error('Worker not available');

    return new Promise<{ audioBlobUrl: string; duration?: number }>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({
        type: 'SYNTHESIZE',
        id,
        payload: { text, voice, speed },
      } satisfies WorkerInMessage);
    });
  }

  public onStatus(fn: StatusListener) {
    this.statusListeners.add(fn);
    fn(this.currentStatus);
    return () => this.statusListeners.delete(fn);
  }

  public onProgress(fn: ProgressListener) {
    this.progressListeners.add(fn);
    return () => this.progressListeners.delete(fn);
  }

  public get status() {
    return this.currentStatus;
  }

  public get ready() {
    return this.currentStatus.status === 'ready';
  }
}

export const ttsWorkerClient = new TTSWorkerClient();
