import { useState, useEffect, useCallback } from 'react';
import { getStorageUsage } from '@/lib/audioCache';

export interface ResourceMetrics {
  ramUsageMB: number | null;
  ramTotalMB: number | null;
  storageUsageMB: number;
  storageQuotaMB: number;
  speedSec: number | null;
}

export function useResourceMonitor(currentSpeedSec: number | null = null) {
  const [metrics, setMetrics] = useState<ResourceMetrics>({
    ramUsageMB: null,
    ramTotalMB: null,
    storageUsageMB: 0,
    storageQuotaMB: 0,
    speedSec: null,
  });

  const updateMetrics = useCallback(async () => {
    let ramUsageMB: number | null = null;
    let ramTotalMB: number | null = null;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as any).memory;
      if (mem && mem.usedJSHeapSize) {
        ramUsageMB = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        ramTotalMB = Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
      }
    }

    const { usageMB, quotaMB } = await getStorageUsage();

    setMetrics({
      ramUsageMB,
      ramTotalMB,
      storageUsageMB: usageMB,
      storageQuotaMB: quotaMB,
      speedSec: currentSpeedSec,
    });
  }, [currentSpeedSec]);

  useEffect(() => {
    updateMetrics();
    const timer = setInterval(updateMetrics, 2000);
    return () => clearInterval(timer);
  }, [updateMetrics]);

  return { metrics, refresh: updateMetrics };
}

