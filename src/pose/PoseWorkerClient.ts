import type { PoseDetection, PoseWorkerResponse } from './poseTypes';
import { MODEL_URL, WASM_URL } from './PoseEngine';

export class PoseWorkerClient {
  private readonly worker: Worker;
  private pendingInit: { resolve: () => void; reject: (reason: Error) => void } | null = null;
  private pendingDetection: { resolve: (value: PoseDetection) => void; reject: (reason: Error) => void } | null = null;
  private closed = false;

  private constructor() {
    this.worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      const response = event.data;
      if (response.kind === 'ready') {
        this.pendingInit?.resolve();
        this.pendingInit = null;
      } else if (response.kind === 'result') {
        this.pendingDetection?.resolve(response.detection);
        this.pendingDetection = null;
      } else {
        const error = new Error(response.message);
        if (this.pendingInit) this.pendingInit.reject(error);
        if (this.pendingDetection) this.pendingDetection.reject(error);
        this.pendingInit = null;
        this.pendingDetection = null;
      }
    };
    this.worker.onerror = (event) => {
      console.error('Pose Worker error', event);
      const error = new Error('姿勢推論Workerを起動できませんでした。');
      this.pendingInit?.reject(error);
      this.pendingDetection?.reject(error);
      this.pendingInit = null;
      this.pendingDetection = null;
    };
  }

  static async create(): Promise<PoseWorkerClient> {
    const client = new PoseWorkerClient();
    try {
      await client.initialize();
      return client;
    } catch (error) {
      client.dispose();
      throw error;
    }
  }

  private initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingInit = null;
        reject(new Error('Workerの初期化がタイムアウトしました。'));
      }, 45000);
      this.pendingInit = {
        resolve: () => { clearTimeout(timeout); resolve(); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      };
      this.worker.postMessage({ kind: 'init', modelUrl: new URL(MODEL_URL, location.href).href, wasmUrl: new URL(WASM_URL, location.href).href });
    });
  }

  async detect(video: HTMLVideoElement, timestamp: number): Promise<PoseDetection> {
    if (this.closed || this.pendingDetection) throw new Error('Workerは利用できません。');
    const bitmap = await createImageBitmap(video);
    if (this.closed || this.pendingDetection) {
      bitmap.close();
      throw new Error('Workerは利用できません。');
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingDetection = null;
        reject(new Error('姿勢推論がタイムアウトしました。'));
        // A late result must never be delivered to a subsequent request.
        this.dispose();
      }, 10000);
      this.pendingDetection = {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      };
      try {
        this.worker.postMessage({ kind: 'detect', bitmap, timestamp }, [bitmap]);
      } catch (error) {
        bitmap.close();
        this.pendingDetection?.reject(error instanceof Error ? error : new Error(String(error)));
        this.pendingDetection = null;
      }
    });
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const error = new Error('姿勢推論を停止しました。');
    this.pendingInit?.reject(error);
    this.pendingDetection?.reject(error);
    this.pendingInit = null;
    this.pendingDetection = null;
    this.worker.terminate();
  }
}
