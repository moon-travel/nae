/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseWorkerRequest, PoseWorkerResponse } from './poseTypes';
import type { Point3D, PoseFrame } from '../types';

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | null = null;
let busy = false;

function post(message: PoseWorkerResponse): void {
  workerScope.postMessage(message);
}

workerScope.onmessage = async (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;
  if (request.kind === 'init') {
    try {
      // This is a module Worker; load the matching module WASM bootstrap.
      const vision = await FilesetResolver.forVisionTasks(request.wasmUrl, true);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: request.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: false,
      });
      post({ kind: 'ready' });
    } catch (error) {
      console.error('MediaPipe worker initialization failed', error);
      post({ kind: 'error', message: 'Worker内の姿勢モデルを読み込めませんでした。' });
    }
    return;
  }

  const { bitmap, timestamp } = request;
  try {
    if (!landmarker || busy) {
      post({ kind: 'error', message: 'Workerはまだ推論を開始できません。' });
      return;
    }
    busy = true;
    const start = performance.now();
    const result = landmarker.detectForVideo(bitmap, timestamp);
    const normalized = result.landmarks[0];
    const world = result.worldLandmarks[0];
    const mapPoint = (point: Point3D): Point3D => ({
      x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0,
    });
    const frame: PoseFrame | null = normalized?.length === 33
      ? { timestamp, imageWidth: bitmap.width, imageHeight: bitmap.height, landmarks: normalized.map(mapPoint), worldLandmarks: world?.map(mapPoint) ?? [] }
      : null;
    post({ kind: 'result', detection: { frame, latencyMs: performance.now() - start } });
  } catch (error) {
    console.error('MediaPipe worker inference failed', error);
    post({ kind: 'error', message: '姿勢推論に失敗しました。' });
  } finally {
    bitmap.close();
    busy = false;
  }
};
