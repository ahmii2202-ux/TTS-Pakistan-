import {
  AccentOption,
  DeliveryMood,
  ExpressionLevel,
  PauseRhythm,
  PitchTilt,
  SpeakingPace,
  StudioAcousticProfile,
  UrduScriptSample,
  VoiceProfile,
} from '../types/voice';

export const PRESET_VOICES: VoiceProfile[] = [
  {
    id: 'preset-zoya',
    name: 'Zoya',
    origin: 'preset',
    baseVoice: 'Kore',
    stylePrompt:
      'Warm, articulate urban Pakistani female voice speaking natural Karachi Urdu and crisp English. Balanced mid-range pitch, gentle conversational cadence, clear dental and retroflex consonants, warm studio presence.',
    language: 'Urdu & English',
    genderTimbre: 'Warm Alto Female',
    pitchProfile: 'Mid-Range Balanced',
    paceProfile: 'Natural Conversational',
    accentNotes: 'Urban Karachi Urdu',
    timbreSummary: 'Warm conversational Urdu & English',
    createdAt: 1700000001000,
  },
  {
    id: 'preset-zain',
    name: 'Zain',
    origin: 'preset',
    baseVoice: 'Charon',
    stylePrompt:
      'Deep, composed Pakistani male narrator voice with authoritative Islamabad broadcast clarity. Steady chest resonance, measured literary Urdu pacing, crisp diction, and dignified pauses between clauses.',
    language: 'Urdu & English',
    genderTimbre: 'Deep Baritone Male',
    pitchProfile: 'Low Chest Resonance',
    paceProfile: 'Measured & Steady',
    accentNotes: 'Standard Broadcast Urdu',
    timbreSummary: 'Deep documentary & news anchor',
    createdAt: 1700000002000,
  },
  {
    id: 'preset-hania',
    name: 'Hania',
    origin: 'preset',
    baseVoice: 'Zephyr',
    stylePrompt:
      'Expressive, lyrical female storyteller voice suited for Urdu shayari, audiobooks, and emotional prose. Soft breath control, delicate melodic inflection, and unhurried poetic phrasing.',
    language: 'Urdu & English',
    genderTimbre: 'Lyrical Mezzo Female',
    pitchProfile: 'Soft Expressive Mid',
    paceProfile: 'Unhurried Poetic',
    accentNotes: 'Classical Literary Urdu',
    timbreSummary: 'Lyrical Urdu poetry & audiobooks',
    createdAt: 1700000003000,
  },
  {
    id: 'preset-hamza',
    name: 'Hamza',
    origin: 'preset',
    baseVoice: 'Puck',
    stylePrompt:
      'Friendly, modern Lahori male podcast host voice with upbeat energy and effortless Urdu-English code-switching. Clear articulation, engaging rhythmic emphasis, and lively conversational warmth.',
    language: 'Urdu & English',
    genderTimbre: 'Bright Tenor Male',
    pitchProfile: 'Dynamic Mid-High',
    paceProfile: 'Engaging & Brisk',
    accentNotes: 'Modern Lahori Bilingual',
    timbreSummary: 'Upbeat podcast & tech presenter',
    createdAt: 1700000004000,
  },
  {
    id: 'preset-salar',
    name: 'Salar',
    origin: 'preset',
    baseVoice: 'Fenrir',
    stylePrompt:
      'Rich, commanding dramatic male voice for cinema trailers, historical Urdu epics, and high-impact narration. Gravitas-filled delivery, resonant low register, and controlled dramatic intensity.',
    language: 'Urdu & English',
    genderTimbre: 'Commanding Bass Male',
    pitchProfile: 'Deep Dramatic Bass',
    paceProfile: 'Deliberate Gravitas',
    accentNotes: 'Classical Dramatic Urdu',
    timbreSummary: 'Dramatic narration & epic trailers',
    createdAt: 1700000005000,
  },
];

export const URDU_SCRIPT_SAMPLES: UrduScriptSample[] = [
  {
    id: 'sample-story',
    label: 'Lahore Evening',
    category: 'Storytelling',
    urduText:
      'لاہور کی شام جب آہستہ آہستہ ڈھلتی ہے، تو پرانی گلیوں میں الائچی والی چائے کی خوشبو اور دور سے آتی ہوئی مدھم آوازیں ایک عجیب سا سکون بکھیر دیتی ہیں۔ <breath> زندگی کی بھاگ دوڑ میں ایسے لمحے دل کو ٹھہراؤ عطا کرتے ہیں۔',
    romanHint: 'Lahore ki shaam jab aahista aahista dhalti hai...',
    recommendedMood: 'storytelling',
  },
  {
    id: 'sample-poetry',
    label: 'Urdu Shayari',
    category: 'Poetic',
    urduText:
      'ستاروں سے آگے جہاں اور بھی ہیں، ابھی عشق کے امتحاں اور بھی ہیں۔ <breath> قناعت نہ کر عالمِ رنگ و بو پر، چمن اور بھی، آشیاں اور بھی ہیں۔',
    romanHint: 'Sitaron se aage jahan aur bhi hain...',
    recommendedMood: 'poetic',
  },
  {
    id: 'sample-news',
    label: 'Broadcast Bulletin',
    category: 'News',
    urduText:
      'السلام علیکم، شام کے اہم ترین خبروں کے بلیٹن میں خوش آمدید۔ آج پاکستان بھر میں جدید ٹیکنالوجی اور مصنوعی ذہانت کے شعبے میں نئے منصوبوں کا اعلان کیا گیا ہے جو طلبہ اور تخلیق کاروں کے لیے مکمل طور پر مفت دستیاب ہوں گے۔',
    romanHint: 'Assalam o Alaikum, shaam ke aham tareen khabron ke bulletin mein khush amdeed.',
    recommendedMood: 'news',
  },
  {
    id: 'sample-audiobook',
    label: 'Audiobook Chapter',
    category: 'Long-Form',
    urduText:
      'باب اول: امید کی روشنی۔ <breath> جب دنیا کے حالات مشکل ہوں اور چاروں طرف بے یقینی کا اندھیرا چھایا ہو، تب بھی انسان کا حوصلہ اور اس کی آواز سب سے بڑی طاقت بن سکتی ہے۔ <breath> اس کتاب میں ہم سیکھیں گے کہ کس طرح سچائی، محنت اور ہمدردی سے نئے راستے تراشے جا سکتے ہیں۔',
    romanHint: 'Baab Awwal: Umeed ki Roshni...',
    recommendedMood: 'dramatic',
  },
  {
    id: 'sample-horror',
    label: 'Horror Tale',
    category: 'Horror',
    urduText:
      'رات کے تین بجے اچانک پرانی حویلی کا بھاری دروازہ خود بخود چرچراتا ہوا کھل گیا۔ <breath> ٹھنڈی ہوا کے ساتھ کمرے میں سائے رینگنے لگے اور پیچھے سے کسی کے قدموں کی سرسراہٹ سنائی دی۔ <gasp> میں نے مڑ کر دیکھا تو اندھیرے میں دو سرخ آنکھیں مجھے گھور رہی تھیں۔',
    romanHint: 'Raat ke teen baje achanak purani haveli ka darwaza khul gaya...',
    recommendedMood: 'horror',
  },
];

export const CLONING_CALIBRATION_PROMPT = {
  urdu: 'میرا نام صدا اسٹوڈیو کی اس آواز کی جانچ کے لیے ریکارڈ کیا جا رہا ہے۔ آج موسم بہت خوشگوار ہے، آسمان صاف ہے اور ہوا میں ہلکی سی خنکی ہے۔ میں چاہتا ہوں کہ میری آواز کا ہر لفظ واضح، قدرتی اور پُرسکون انداز میں سنائی دے۔',
  roman:
    'Mera naam SadaStudio ki is aawaz ki jaanch ke liye record kiya ja raha hai. Aaj mausam bohat khushgawar hai, aasman saaf hai aur hawa mein halki si khunki hai. Main chahta hoon ke meri aawaz ka har lafz wazeh, qudrati aur pur-sukoon andaaz mein sunai de.',
};

export const DELIVERY_MOODS: Array<{ id: DeliveryMood; label: string; hint: string }> = [
  { id: 'natural', label: 'Natural', hint: 'Balanced human delivery' },
  { id: 'storytelling', label: 'Storytelling', hint: 'Warm narrative flow' },
  { id: 'news', label: 'Broadcast News', hint: 'Crisp anchor clarity' },
  { id: 'poetic', label: 'Poetic / Shayari', hint: 'Lyrical Urdu rhythm' },
  { id: 'calm', label: 'Warm & Calm', hint: 'Soothing gentle tone' },
  { id: 'energetic', label: 'Energetic', hint: 'Upbeat presenter style' },
  { id: 'dramatic', label: 'Dramatic', hint: 'Cinematic depth & weight' },
  { id: 'whisper', label: 'Soft Intimate', hint: 'Quiet close-mic feel' },
  { id: 'lecture', label: 'Teacher / Lecture', hint: 'Clear educational pacing' },
  { id: 'cheerful', label: 'Cheerful', hint: 'Warm smiling tone' },
  { id: 'horror', label: 'Horror', hint: 'Chilling eerie suspense & dread' },
  { id: 'scary', label: 'Scary / Sinister', hint: 'Dark ominous menace & shadow' },
  { id: 'feared', label: 'Feared / Terrified', hint: 'Trembling anxious fear & panic' },
];

export const ACCENT_OPTIONS: Array<{ id: AccentOption; label: string; description: string }> = [
  { id: 'auto', label: 'Match Selected Voice', description: 'Preserve the voice’s natural accent' },
  { id: 'islamabad_broadcast', label: 'Islamabad Broadcast Urdu', description: 'Crisp, neutral Pakistani Urdu diction' },
  { id: 'karachi_urban', label: 'Karachi Urban Urdu', description: 'Modern cosmopolitan Urdu-English blend' },
  { id: 'lahori_expressive', label: 'Lahori Expressive Urdu', description: 'Warm, lively conversational cadence' },
  { id: 'classical_adab', label: 'Classical Literary Adab', description: 'Refined poetic & classical pronunciation' },
  { id: 'punjabi_urdu', label: 'Punjabi-Inflected Warm Urdu', description: 'Grounded, friendly heartfelt tone' },
  { id: 'pakistani_english', label: 'Pakistani English', description: 'Clear South Asian English articulation' },
  { id: 'international_english', label: 'International English', description: 'Neutral global English diction' },
];

export const EXPRESSION_LEVELS: Array<{ id: ExpressionLevel; label: string }> = [
  { id: 'subtle', label: 'Subtle' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'expressive', label: 'Expressive' },
  { id: 'theatrical', label: 'Theatrical' },
];

export const PAUSE_RHYTHMS: Array<{ id: PauseRhythm; label: string }> = [
  { id: 'tight', label: 'Tight' },
  { id: 'natural', label: 'Natural' },
  { id: 'reflective', label: 'Reflective' },
];

export const ACOUSTIC_PROFILES: Array<{ id: StudioAcousticProfile; label: string; detail: string }> = [
  { id: 'condenser_warm', label: 'Studio Condenser', detail: 'Close-mic vocal warmth & body' },
  { id: 'broadcast_crisp', label: 'Broadcast Radio', detail: 'Punchy, articulate vocal presence' },
  { id: 'audiobook_velvet', label: 'Audiobook Velvet', detail: 'Smooth, fatigue-free listening' },
  { id: 'raw_studio', label: 'Raw Uncolored', detail: 'Pure neural synthesis output' },
];

export const PITCH_TILTS: Array<{ id: PitchTilt; label: string }> = [
  { id: 'deeper', label: 'Deeper' },
  { id: 'natural', label: 'Natural' },
  { id: 'brighter', label: 'Brighter' },
];

export const SPEAKING_PACES: Array<{ id: SpeakingPace; label: string }> = [
  { id: 'slow', label: '0.8x' },
  { id: 'measured', label: '0.9x' },
  { id: 'normal', label: '1.0x' },
  { id: 'brisk', label: '1.15x' },
  { id: 'fast', label: '1.3x' },
];
