import type { PoseFrame } from '../types';

export interface PoseDetection {
  frame: PoseFrame | null;
  latencyMs: number;
}

export type PoseWorkerRequest =
  | { kind: 'init'; modelUrl: string; wasmUrl: string }
  | { kind: 'detect'; bitmap: ImageBitmap; timestamp: number };

export type PoseWorkerResponse =
  | { kind: 'ready' }
  | { kind: 'result'; detection: PoseDetection }
  | { kind: 'error'; message: string };
