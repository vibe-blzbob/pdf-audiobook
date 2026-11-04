import { useEffect } from 'react';
import Home from './app/page';
import { ttsWorkerClient } from '@/lib/workerClient';

export default function App() {
  useEffect(() => {
    ttsWorkerClient
      .ping()
      .then((ts) => {
        const latency = Date.now() - ts;
        console.log(`[TTS Worker] Online! Round-trip latency: ${latency}ms`);
      })
      .catch((err) => console.warn('[TTS Worker] Ping failed:', err));

    ttsWorkerClient.init();
  }, []);

  return <Home />;
}
