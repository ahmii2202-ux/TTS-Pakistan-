import { GeneratedClip, VoiceProfile } from '../types/voice';

const DB_NAME = 'sadastudio_db';
const DB_VERSION = 2;
const VOICES_STORE = 'cloned_voices';
const CLIPS_STORE = 'generated_clips';
const CHECKPOINT_STORE = 'synthesis_checkpoints';

export interface SynthesisCheckpoint {
  id: string; // 'active_job'
  clipId: string;
  sourceText: string;
  voiceId: string;
  voiceName: string;
  baseVoice: string;
  stylePrompt: string;
  mood: string;
  accent: string;
  pace: string;
  expressionLevel: string;
  pauseRhythm: string;
  acousticProfile: string;
  pitchTilt: string;
  modelUsed: string;
  customDirection: string;
  totalChunks: number;
  totalWords: number;
  completedChunks: number;
  processedWords: number;
  chunkWordLimit?: number;
  wavChunks: string[];
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VOICES_STORE)) {
        db.createObjectStore(VOICES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CLIPS_STORE)) {
        db.createObjectStore(CLIPS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getClonedVoices(): Promise<VoiceProfile[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICES_STORE, 'readonly');
    const store = tx.objectStore(VOICES_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as VoiceProfile[]) || [];
      resolve(rows.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveClonedVoice(voice: VoiceProfile): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICES_STORE, 'readwrite');
    const store = tx.objectStore(VOICES_STORE);
    store.put(voice);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteClonedVoice(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICES_STORE, 'readwrite');
    const store = tx.objectStore(VOICES_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getGeneratedClips(): Promise<GeneratedClip[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CLIPS_STORE, 'readonly');
    const store = tx.objectStore(CLIPS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as GeneratedClip[]) || [];
      resolve(rows.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveGeneratedClip(clip: GeneratedClip): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CLIPS_STORE, 'readwrite');
    const store = tx.objectStore(CLIPS_STORE);
    store.put(clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGeneratedClip(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CLIPS_STORE, 'readwrite');
    const store = tx.objectStore(CLIPS_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSynthesisCheckpoint(checkpoint: SynthesisCheckpoint): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
    const store = tx.objectStore(CHECKPOINT_STORE);
    store.put(checkpoint);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSynthesisCheckpoint(): Promise<SynthesisCheckpoint | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHECKPOINT_STORE, 'readonly');
    const store = tx.objectStore(CHECKPOINT_STORE);
    const req = store.get('active_job');
    req.onsuccess = () => resolve((req.result as SynthesisCheckpoint) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSynthesisCheckpoint(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
    const store = tx.objectStore(CHECKPOINT_STORE);
    store.delete('active_job');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
