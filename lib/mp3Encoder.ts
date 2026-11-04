import { Mp3Encoder } from '@breezystack/lamejs';

export interface Mp3EncodingProgress {
  current: number;
  total: number;
  percent: number;
}

/**
 * Encodes an ordered array of WAV Blobs into a single unified MP3 Blob,
 * inserting pauseMs silence between sentences for natural cadence.
 */
export async function encodeWavBlobsToMp3(
  blobs: Blob[],
  onProgress?: (progress: Mp3EncodingProgress) => void,
  pauseMs = 250
): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error('No audio chunks provided for MP3 encoding');
  }

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser environment');
  }

  const audioCtx = new AudioCtx();

  try {
    let encoder: Mp3Encoder | null = null;
    const mp3Chunks: Uint8Array[] = [];
    let silenceInt16: Int16Array | null = null;

    for (let i = 0; i < blobs.length; i++) {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: blobs.length,
          percent: Math.round(((i + 1) / blobs.length) * 100),
        });
      }

      const arrayBuffer = await blobs[i].arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      if (!encoder) {
        const sampleRate = audioBuffer.sampleRate;
        encoder = new Mp3Encoder(1, sampleRate, 128);

        const silenceSamples = Math.floor((pauseMs / 1000) * sampleRate);
        silenceInt16 = new Int16Array(silenceSamples);
      }

      const channelData = audioBuffer.getChannelData(0);
      const int16 = new Int16Array(channelData.length);
      for (let j = 0; j < channelData.length; j++) {
        const s = Math.max(-1, Math.min(1, channelData[j]));
        int16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const chunkMp3 = encoder.encodeBuffer(int16);
      if (chunkMp3.length > 0) {
        mp3Chunks.push(chunkMp3);
      }

      // Natural pause between sentences (skip after last chunk)
      if (i < blobs.length - 1 && silenceInt16 && silenceInt16.length > 0) {
        const silenceMp3 = encoder.encodeBuffer(silenceInt16);
        if (silenceMp3.length > 0) {
          mp3Chunks.push(silenceMp3);
        }
      }
    }

    if (encoder) {
      const remaining = encoder.flush();
      if (remaining.length > 0) {
        mp3Chunks.push(remaining);
      }
    }

    return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mp3' });
  } finally {
    await audioCtx.close();
  }
}

