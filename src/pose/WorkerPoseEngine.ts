import type { PoseEngine } from './PoseEngine';
import type { PoseDetection } from './poseTypes';
import { PoseWorkerClient } from './PoseWorkerClient';

export class WorkerPoseEngine implements PoseEngine {
  readonly mode = 'worker' as const;
  private constructor(private readonly client: PoseWorkerClient) {}

  static async create(): Promise<WorkerPoseEngine> {
    if (!('Worker' in window) || !('createImageBitmap' in window)) throw new Error('WorkerまたはImageBitmapが利用できません。');
    return new WorkerPoseEngine(await PoseWorkerClient.create());
  }

  detect(video: HTMLVideoElement, timestamp: number): Promise<PoseDetection> {
    return this.client.detect(video, timestamp);
  }

  dispose(): void { this.client.dispose(); }
}
