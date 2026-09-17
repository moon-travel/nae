import type { PerformanceStats, SquatMetrics } from '../types';

export interface ResearchPanelProps {
  metrics: SquatMetrics | null;
  performance?: PerformanceStats | null;
  visible?: number;
  research?: boolean;
}

const number = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const percent = (value: number | null | undefined) => value == null ? '—' : `${number(value * 100, 1)}%`;

export function ResearchPanel({ metrics, performance, visible, research = true }: ResearchPanelProps) {
  if (!research) return null;
  const rows: [string, string][] = [
    ['Phase / 状態', metrics?.phase ?? '—'], ['Depth / 深度', number(metrics?.depth)], ['Velocity / 速度', number(metrics?.velocity)],
    ['Torso lean / 体幹傾斜', `${number(metrics?.torsoLean, 1)}°`], ['Hip shift / 骨盤移動', number(metrics?.hipShift)],
    ['左膝オフセット', number(metrics?.leftKneeOffset)], ['右膝オフセット', number(metrics?.rightKneeOffset)],
    ['左右差', number(metrics?.kneeTrackingAsymmetry)], ['左膝角度（推定）', `${number(metrics?.estimatedLeftKneeAngle3D, 1)}°`],
    ['右膝角度（推定）', `${number(metrics?.estimatedRightKneeAngle3D, 1)}°`], ['Occupancy / 占有率', percent(metrics?.bodyOccupancy)],
    ['Quality / 品質', percent(metrics?.quality)], ['Visibility / 可視性', percent(visible == null ? metrics?.quality : visible)],
    ['Camera FPS', number(performance?.cameraFps, 1)], ['Inference FPS', number(performance?.inferenceFps, 1)],
    ['Inference latency', `${number(performance?.inferenceLatencyMs, 1)} ms`], ['Dropped / skipped', number(performance?.droppedFrames, 0)],
  ];
  return <section className="research-panel" aria-label="研究モード測定値"><div className="research-panel__heading"><h2>Research / Debug</h2><span>推定値</span></div><dl>{rows.map(([label, value]) => <div className="metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

export default ResearchPanel;
