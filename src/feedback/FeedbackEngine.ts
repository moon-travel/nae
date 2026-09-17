import type { FeedbackCandidate, FeedbackType } from '../types';
import { Speech } from './Speech';
import { feedbackConfig } from './feedbackConfig';

export interface FeedbackEngineOptions { enabled?: boolean; cooldownMs?: number; minDurationMs?: number; speech?: Speech; }
const text: Record<string, string> = { TORSO_LEAN: '体を中央に戻してください', HIP_SHIFT: '左右のバランスを整えてください', KNEE_ASYMMETRY: '左右の動きをそろえてください' };
const priority: Record<string, number> = Object.fromEntries(feedbackConfig.priority.map((type, index) => [type, feedbackConfig.priority.length - index]));

export class FeedbackEngine {
  private enabled: boolean; private active = false; private speechToken = 0; private readonly lastSpoken = new Map<FeedbackType, number>(); private readonly speech: Speech; private readonly cooldownMs: number; private readonly minDurationMs: number;
  constructor(options: FeedbackEngineOptions = {}) { this.enabled = options.enabled ?? true; this.cooldownMs = options.cooldownMs ?? feedbackConfig.cooldownMs; this.minDurationMs = options.minDurationMs ?? feedbackConfig.minimumDurationMs; this.speech = options.speech ?? new Speech(); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) { this.speech.cancel(); this.active = false; this.speechToken += 1; } }
  isEnabled() { return this.enabled; }
  handle(candidates: FeedbackCandidate | readonly FeedbackCandidate[], now = Date.now()): FeedbackType | null {
    if (!this.enabled || this.active) return null;
    const list = Array.isArray(candidates) ? candidates : [candidates];
    const candidate = list.filter(c => c.durationMs >= this.minDurationMs)
      .filter(c => c.type !== 'KNEE_ASYMMETRY' || feedbackConfig.enableKneeAsymmetry)
      .filter(c => now - (this.lastSpoken.get(c.type) ?? 0) >= this.cooldownMs)
      .sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0) || b.severity - a.severity)[0];
    if (!candidate) return null;
    const message = text[candidate.type]; if (!message) return null;
    const token = ++this.speechToken; this.active = true;
    const ok = this.speech.speak(message, () => { if (this.speechToken === token) this.active = false; });
    if (!ok) { if (this.speechToken === token) this.active = false; return null; }
    this.lastSpoken.set(candidate.type, now);
    return candidate.type;
  }
  dispose() { this.speechToken += 1; this.speech.dispose(); this.active = false; }
}
