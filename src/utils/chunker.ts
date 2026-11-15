export interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Splits arbitrarily large Urdu, Roman Urdu, or English scripts (100,000+ words)
 * into clean sentence-aligned synthesis segments (~180 words max per segment)
 * so long-form books, lectures, and articles never truncate or time out.
 */
export function splitTextIntoSpeechChunks(
  rawText: string,
  maxWordsPerChunk = 180
): TextChunk[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const paragraph of paragraphs) {
    // Split on Urdu full stop (۔), Urdu question (؟), Latin (. ? !), preserving punctuation
    const parts = paragraph
      .split(/(?<=[۔؟.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      sentences.push(...parts);
    }
  }

  const chunks: TextChunk[] = [];
  let currentParts: string[] = [];
  let currentWordCount = 0;

  const flushChunk = () => {
    if (currentParts.length === 0) return;
    const text = currentParts.join(' ').trim();
    if (text) {
      chunks.push({
        index: chunks.length,
        text,
        wordCount: countWords(text),
      });
    }
    currentParts = [];
    currentWordCount = 0;
  };

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);

    // If a single sentence itself exceeds maxWordsPerChunk (e.g., unpunctuated text),
    // split cleanly by words so nothing ever exceeds model bounds.
    if (sentenceWords > maxWordsPerChunk) {
      flushChunk();
      const words = sentence.split(/\s+/);
      for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        const slice = words.slice(i, i + maxWordsPerChunk).join(' ');
        chunks.push({
          index: chunks.length,
          text: slice,
          wordCount: countWords(slice),
        });
      }
      continue;
    }

    if (currentWordCount + sentenceWords > maxWordsPerChunk && currentParts.length > 0) {
      flushChunk();
    }

    currentParts.push(sentence);
    currentWordCount += sentenceWords;
  }

  flushChunk();
  return chunks;
}
