export interface KokoroVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: 'American' | 'British';
  grade?: string;
}

export const KOKORO_VOICES: KokoroVoiceOption[] = [
  { id: 'af_heart', name: 'Heart (Natural)', gender: 'female', accent: 'American', grade: 'A' },
  { id: 'af_bella', name: 'Bella', gender: 'female', accent: 'American', grade: 'A-' },
  { id: 'af_nicole', name: 'Nicole', gender: 'female', accent: 'American', grade: 'B-' },
  { id: 'af_sarah', name: 'Sarah', gender: 'female', accent: 'American', grade: 'B' },
  { id: 'am_adam', name: 'Adam', gender: 'male', accent: 'American' },
  { id: 'am_michael', name: 'Michael', gender: 'male', accent: 'American' },
  { id: 'bf_emma', name: 'Emma', gender: 'female', accent: 'British' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'female', accent: 'British' },
  { id: 'bm_george', name: 'George', gender: 'male', accent: 'British' },
  { id: 'bm_fable', name: 'Fable', gender: 'male', accent: 'British' },
];

