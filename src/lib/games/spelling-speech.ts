/**
 * Web Speech API helpers for Spelling Bee pronunciation.
 * Uses built-in browser TTS; no external API key required.
 */

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prefer a clear, natural voice when available */
function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel") || v.name.includes("Karen"))
  );
  if (preferred) return preferred;
  const en = voices.find((v) => v.lang.startsWith("en-"));
  return en ?? voices[0] ?? null;
}

/**
 * Pronounce a word (for spelling bee). Slightly slower rate for clarity.
 */
export function pronounceWord(
  word: string,
  onEnd?: () => void
): void {
  if (!isSpeechSupported() || !word.trim()) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.trim());
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = getPreferredVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = () => onEnd();
  window.speechSynthesis.speak(utterance);
}

/**
 * Speak arbitrary text (definition or sentence) at normal speed.
 */
export function speakText(text: string, onEnd?: () => void): void {
  if (!isSpeechSupported() || !text.trim()) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = getPreferredVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = () => onEnd();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** iOS Safari often requires a user gesture before speech. */
export function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
