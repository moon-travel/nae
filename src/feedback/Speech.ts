export class Speech {
  private voice: SpeechSynthesisVoice | null = null;
  private available = typeof window !== 'undefined' && 'speechSynthesis' in window;
  constructor(private readonly lang = 'ja-JP') { this.refreshVoice(); }
  private refreshVoice() { if (!this.available) return; const voices = window.speechSynthesis.getVoices(); this.voice = voices.find(v => v.lang.toLowerCase().startsWith('ja')) ?? voices[0] ?? null; }
  speak(text: string, onDone?: () => void): boolean {
    if (!this.available) return false;
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return false;
      this.refreshVoice(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = this.lang;
      // Leaving voice unset is the browser's supported fallback when ja-JP is unavailable.
      if (this.voice?.lang.toLowerCase().startsWith('ja')) utterance.voice = this.voice;
      utterance.onend = () => onDone?.(); utterance.onerror = () => onDone?.();
      window.speechSynthesis.speak(utterance); return true;
    } catch { return false; }
  }
  cancel() { if (this.available) window.speechSynthesis.cancel(); }
  dispose() { this.cancel(); }
}
