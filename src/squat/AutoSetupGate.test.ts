import { describe, expect, it } from "vitest";
import type { QualityGateResult } from "../types";
import { AutoSetupGate } from "./AutoSetupGate";

const accepted: QualityGateResult = { accepted: true, score: 1, bodyOccupancy: 0.6, reason: "OK" };
const rejected: QualityGateResult = { accepted: false, score: 0, bodyOccupancy: 0, reason: "NO_POSE" };

describe("AutoSetupGate", () => {
  it("fires once after continuously stable accepted quality", () => {
    const gate = new AutoSetupGate();
    expect(gate.update(accepted, 0)).toEqual({ triggered: false, progress: 0 });
    expect(gate.update(accepted, 200)).toEqual({ triggered: false, progress: 200 / 1_200 });
    gate.update(accepted, 400); gate.update(accepted, 600); gate.update(accepted, 800); gate.update(accepted, 1_000);
    expect(gate.update(accepted, 1_200)).toEqual({ triggered: true, progress: 1 });
    expect(gate.update(accepted, 3_000)).toEqual({ triggered: false, progress: 1 });
  });
  it("resets the dwell timer on an unacceptable frame", () => {
    const gate = new AutoSetupGate();
    gate.update(accepted, 0);
    expect(gate.update(rejected, 1_000)).toEqual({ triggered: false, progress: 0 });
    expect(gate.update(accepted, 1_100).progress).toBe(0);
    for (let timestamp = 1_300; timestamp < 2_300; timestamp += 200) gate.update(accepted, timestamp);
    expect(gate.update(accepted, 2_300).triggered).toBe(true);
  });
  it("can be explicitly rearmed", () => {
    const gate = new AutoSetupGate();
    gate.update(accepted, 0);
    for (let timestamp = 200; timestamp < 1_200; timestamp += 200) gate.update(accepted, timestamp);
    expect(gate.update(accepted, 1_200).triggered).toBe(true);
    gate.reset();
    expect(gate.update(accepted, 2_000).triggered).toBe(false);
    for (let timestamp = 2_200; timestamp < 3_200; timestamp += 200) gate.update(accepted, timestamp);
    expect(gate.update(accepted, 3_200).triggered).toBe(true);
  });
  it("restarts the dwell period after an accepted-sample gap", () => {
    const gate = new AutoSetupGate();
    gate.update(accepted, 0);
    expect(gate.update(accepted, 1_300)).toEqual({ triggered: false, progress: 0 });
    for (let timestamp = 1_500; timestamp < 2_500; timestamp += 200) gate.update(accepted, timestamp);
    expect(gate.update(accepted, 2_500).triggered).toBe(true);
  });
});
