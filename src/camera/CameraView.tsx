import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Point3D, PoseFrame } from '../types';

export interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  pose?: PoseFrame | null;
  poseRef?: RefObject<PoseFrame | null>;
  research?: boolean;
  status?: string;
  className?: string;
}

const EDGES: readonly [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];

function drawOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, pose: PoseFrame | null, research: boolean) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (!pose?.landmarks?.length) return;
  // The canvas is mirrored by CSS together with the video, so retain normalized
  // landmark coordinates here and let presentation apply the same transform.
  const point = (p: Point3D) => ({ x: p.x * width, y: p.y * height });
  ctx.lineWidth = Math.max(2, width / 500);
  ctx.strokeStyle = '#72f2c4';
  for (const [a, b] of EDGES) {
    const pa = pose.landmarks[a]; const pb = pose.landmarks[b];
    if (!pa || !pb || Math.min(pa.visibility, pb.visibility) < 0.2) continue;
    const p1 = point(pa); const p2 = point(pb); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.fillStyle = research ? '#ffdc69' : '#fff';
  for (const [index, landmark] of pose.landmarks.entries()) {
    if (!research && index !== 11 && index !== 12 && index !== 23 && index !== 24 && index < 25) continue;
    if (landmark.visibility < 0.2) continue;
    const p = point(landmark); ctx.beginPath(); ctx.arc(p.x, p.y, research ? 4 : 5, 0, Math.PI * 2); ctx.fill();
  }
}

export function CameraView({ videoRef, pose, poseRef, research = false, status, className = '' }: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posePropRef = useRef<PoseFrame | null>(pose ?? null);
  posePropRef.current = pose ?? null;
  useEffect(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let frame = 0;
    const render = () => { drawOverlay(canvas, video, poseRef?.current ?? posePropRef.current, research); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [videoRef, poseRef, research]);
  return <div className={`camera-view ${className}`}>
    <video ref={videoRef} className="camera-view__video" autoPlay playsInline muted aria-label="カメラ映像" />
    <canvas ref={canvasRef} className="camera-view__overlay" aria-hidden="true" />
    {status && <div className="camera-view__status" role="status">{status}</div>}
  </div>;
}

export default CameraView;
