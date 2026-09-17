import type { SquatPhase } from "../types";
import { analysisConfig } from "./analysisConfig";

export interface StateUpdate { phase: SquatPhase; velocity: number; phaseChanged: boolean; repCompleted: boolean; repStarted: boolean; }

export class SquatStateMachine {
  private phaseValue: SquatPhase = "READY";
  private previous: { depth: number; timestamp: number } | null = null;
  private candidate: { phase: SquatPhase; since: number } | null = null;
  private deepestDepth = 0;
  private bottomIntent = false;
  private ascendingIntent = false;
  get phase(): SquatPhase { return this.phaseValue; }
  reset(): void { this.phaseValue = "READY"; this.previous = null; this.candidate = null; this.deepestDepth = 0; this.bottomIntent = false; this.ascendingIntent = false; }
  /** Keeps the phase but prevents a stale frame gap from producing a false velocity. */
  resetVelocity(): void { this.previous = null; this.candidate = null; }
  update(depth: number, timestamp: number): StateUpdate {
    const prior = this.previous;
    const velocity = prior && timestamp > prior.timestamp ? (depth - prior.depth) / ((timestamp - prior.timestamp) / 1000) : 0;
    this.previous = { depth, timestamp };
    let target: SquatPhase | null = null;
    if (this.phaseValue === "READY" && depth >= analysisConfig.phase.startDepth && velocity >= analysisConfig.phase.descentVelocity) target = "DESCENDING";
    if (this.phaseValue === "DESCENDING") {
      this.deepestDepth = Math.max(this.deepestDepth, depth);
      if ((depth >= analysisConfig.phase.bottomMinDepth && Math.abs(velocity) <= analysisConfig.phase.bottomVelocity) || (velocity <= -analysisConfig.phase.ascentVelocity && this.deepestDepth >= analysisConfig.phase.bottomMinDepth)) this.bottomIntent = true;
      if (this.bottomIntent) target = "BOTTOM";
      if (depth <= analysisConfig.phase.readyDepth && this.deepestDepth < analysisConfig.phase.bottomMinDepth) target = "READY";
    }
    if (this.phaseValue === "BOTTOM") { if (velocity <= -analysisConfig.phase.ascentVelocity) this.ascendingIntent = true; if (this.ascendingIntent) target = "ASCENDING"; }
    if (this.phaseValue === "ASCENDING" && depth <= analysisConfig.phase.readyDepth) target = "READY";
    let phaseChanged = false; let repCompleted = false; let repStarted = false;
    if (target) {
      if (this.candidate?.phase !== target) this.candidate = { phase: target, since: timestamp };
      if (timestamp - this.candidate.since >= analysisConfig.phase.minPhaseDurationMs) {
        const previousPhase = this.phaseValue; this.phaseValue = target; this.candidate = null; phaseChanged = true;
        if (target === "DESCENDING") { this.deepestDepth = depth; this.bottomIntent = false; this.ascendingIntent = false; }
        if (target === "BOTTOM") this.ascendingIntent = velocity <= -analysisConfig.phase.ascentVelocity;
        if (target === "READY") { this.deepestDepth = 0; this.bottomIntent = false; this.ascendingIntent = false; }
        repStarted = previousPhase === "READY" && target === "DESCENDING";
        repCompleted = previousPhase === "ASCENDING" && target === "READY";
      }
    } else this.candidate = null;
    return { phase: this.phaseValue, velocity, phaseChanged, repCompleted, repStarted };
  }
}
