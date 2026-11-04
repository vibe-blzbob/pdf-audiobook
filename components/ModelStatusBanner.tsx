import React, { useEffect, useState } from 'react';
import { ttsWorkerClient, type TTSStatus, type TTSProgress } from '@/lib/workerClient';
import { Cpu, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export const ModelStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<TTSStatus>(ttsWorkerClient.status);
  const [progress, setProgress] = useState<TTSProgress | null>(null);

  useEffect(() => {
    const unsubStatus = ttsWorkerClient.onStatus(setStatus);
    const unsubProgress = ttsWorkerClient.onProgress(setProgress);
    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, []);

  if (status.status === 'ready') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-full">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Kokoro Neural Engine: Ready (100% Offline)</span>
      </div>
    );
  }

  if (status.status === 'loading') {
    return (
      <div className="flex flex-col gap-1.5 px-3.5 py-2 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs text-indigo-200 w-full max-w-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span className="font-semibold">{status.message || 'Loading model...'}</span>
          </div>
          {progress && progress.progress > 0 && (
            <span className="font-mono text-indigo-300">{progress.progress}%</span>
          )}
        </div>
        {progress && progress.progress > 0 && (
          <div className="w-full bg-indigo-900/50 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-400 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
            />
          </div>
        )}
        <span className="text-[10px] text-indigo-300/70">
          Cached permanently in browser storage — zero internet needed afterwards.
        </span>
      </div>
    );
  }

  if (status.status === 'error') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/50 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
        <span className="truncate">{status.message || 'Neural engine failed to load'}</span>
        <button
          onClick={() => ttsWorkerClient.init()}
          className="ml-auto underline hover:text-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
};

