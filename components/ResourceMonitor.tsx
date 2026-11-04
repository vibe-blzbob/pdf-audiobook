import React from 'react';
import { Cpu, HardDrive, Zap } from 'lucide-react';
import type { ResourceMetrics } from '@/hooks/useResourceMonitor';

interface ResourceMonitorProps {
  metrics: ResourceMetrics;
  isProcessing?: boolean;
}

export const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ metrics, isProcessing }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-[11px] font-mono text-zinc-400">
      {/* RAM / JS Heap */}
      <div className="flex items-center gap-1.5" title="Active JavaScript Heap Memory">
        <Cpu className={`w-3.5 h-3.5 ${isProcessing ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
        <span>RAM:</span>
        <span className="text-zinc-200 font-semibold">
          {metrics.ramUsageMB !== null ? `${metrics.ramUsageMB} MB` : 'Browser-managed'}
        </span>
        {metrics.ramTotalMB !== null && (
          <span className="text-zinc-600 text-[10px]">/ {metrics.ramTotalMB} MB</span>
        )}
      </div>

      <div className="w-[1px] h-3 bg-zinc-800 hidden sm:block" />

      {/* IndexedDB Cache Storage */}
      <div className="flex items-center gap-1.5" title="Local IndexedDB Audio Cache">
        <HardDrive className="w-3.5 h-3.5 text-purple-400" />
        <span>Cache:</span>
        <span className="text-zinc-200 font-semibold">{metrics.storageUsageMB} MB</span>
      </div>

      <div className="w-[1px] h-3 bg-zinc-800 hidden sm:block" />

      {/* TTS Speed */}
      <div className="flex items-center gap-1.5" title="Synthesis Speed">
        <Zap className={`w-3.5 h-3.5 ${metrics.speedSec ? 'text-emerald-400' : 'text-zinc-500'}`} />
        <span>Speed:</span>
        <span className="text-zinc-200 font-semibold">
          {metrics.speedSec ? `${metrics.speedSec.toFixed(1)}s/chunk` : isProcessing ? 'Computing...' : 'Idle'}
        </span>
      </div>
    </div>
  );
};

