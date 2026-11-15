export type BaseVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type TtsModelId =
  | 'gemini-3.8-flash-tts'
  | 'gemini-3.8-flash-lite-tts'
  | 'unlimited-neural';

export type DeliveryMood =
  | 'natural'
  | 'storytelling'
  | 'news'
  | 'poetic'
  | 'calm'
  | 'energetic'
  | 'dramatic'
  | 'whisper'
  | 'lecture'
  | 'cheerful'
  | 'horror'
  | 'scary'
  | 'feared';

export type AccentOption =
  | 'auto'
  | 'islamabad_broadcast'
  | 'karachi_urban'
  | 'lahori_expressive'
  | 'classical_adab'
  | 'punjabi_urdu'
  | 'pakistani_english'
  | 'international_english';

export type ExpressionLevel = 'subtle' | 'balanced' | 'expressive' | 'theatrical';

export type PauseRhythm = 'tight' | 'natural' | 'reflective';

export type StudioAcousticProfile =
  | 'condenser_warm'
  | 'broadcast_crisp'
  | 'audiobook_velvet'
  | 'raw_studio';

export type PitchTilt = 'deeper' | 'natural' | 'brighter';

export type SpeakingPace = 'slow' | 'measured' | 'normal' | 'brisk' | 'fast';

export interface SpeechSynthesisSettings {
  mood: DeliveryMood;
  accent: AccentOption;
  pace: SpeakingPace;
  expressionLevel: ExpressionLevel;
  pauseRhythm: PauseRhythm;
  acousticProfile: StudioAcousticProfile;
  pitchTilt: PitchTilt;
  engine: TtsModelId;
  customDirection: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  origin: 'preset' | 'cloned';
  baseVoice: BaseVoiceName;
  stylePrompt: string;
  language: string;
  genderTimbre: string;
  pitchProfile: string;
  paceProfile: string;
  accentNotes: string;
  timbreSummary: string;
  sampleTranscript?: string;
  referenceAudioBase64?: string;
  referenceMimeType?: string;
  createdAt: number;
}

export interface GeneratedClip {
  id: string;
  mode: 'single' | 'dialogue';
  voiceId: string;
  voiceName: string;
  secondaryVoiceName?: string;
  text: string;
  wordCount?: number;
  mood: string;
  accent?: string;
  modelUsed: string;
  audioBase64: string;
  mimeType: string;
  durationSec: number;
  createdAt: number;
}

export interface DialogueTurn {
  id: string;
  speaker: 'A' | 'B';
  text: string;
}

export interface UrduScriptSample {
  id: string;
  label: string;
  category: string;
  urduText: string;
  romanHint: string;
  recommendedMood: DeliveryMood;
}
