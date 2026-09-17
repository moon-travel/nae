import { describe, expect, it } from "vitest";
import { SquatStateMachine } from "./SquatStateMachine";

function feed(machine: SquatStateMachine, values: number[]): number {
  let timestamp = 0; let reps = 0;
  for (const depth of values) {
    timestamp += 70;
    if (machine.update(depth, timestamp).repCompleted) reps += 1;
  }
  return reps;
}
describe("SquatStateMachine", () => {
  it("recognizes one controlled squat", () => {
    const machine = new SquatStateMachine();
    expect(feed(machine, [0, 0, 0.03, 0.09, 0.12, 0.16, 0.2, 0.23, 0.24, 0.24, 0.22, 0.18, 0.13, 0.09, 0.045, 0.03, 0.02, 0.02, 0.02])).toBe(1);
    expect(machine.phase).toBe("READY");
  });
  it("does not chatter through phases on shallow noise", () => {
    const machine = new SquatStateMachine();
    expect(feed(machine, [0, 0.02, 0.06, 0.07, 0.06, 0.07, 0.04, 0.06, 0.03, 0.02])).toBe(0);
    expect(machine.phase).toBe("READY");
  });
  it("recovers to ready after a shallow aborted descent", () => {
    const machine = new SquatStateMachine();
    feed(machine, [0, 0.09, 0.12, 0.14, 0.11, 0.07, 0.04, 0.03, 0.02]);
    expect(machine.phase).toBe("READY");
  });
  it("does not lose a bottom or ascending transition when the athlete becomes still", () => {
    const machine = new SquatStateMachine();
    expect(feed(machine, [0, 0.09, 0.13, 0.18, 0.22, 0.2, 0.2, 0.2, 0.16, 0.16, 0.16, 0.1, 0.05, 0.03, 0.02, 0.02, 0.02])).toBe(1);
  });
  it("recognizes an immediate turnaround without a bottom pause", () => {
    const machine = new SquatStateMachine();
    expect(feed(machine, [0, 0.09, 0.13, 0.18, 0.22, 0.2, 0.16, 0.1, 0.05, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02])).toBe(1);
  });
  it("does not infer velocity across an invalid-frame reset", () => {
    const machine = new SquatStateMachine();
    machine.update(0, 100);
    machine.update(0.1, 170);
    machine.resetVelocity();
    expect(machine.update(0.2, 2_000).velocity).toBe(0);
  });
});
