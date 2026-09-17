import { useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, startCamera, stopCamera } from '../camera/camera';
import { CameraView } from '../camera/CameraView';
import { FeedbackEngine } from '../feedback/FeedbackEngine';
import { RuleEngine } from '../feedback/RuleEngine';
import { MainThreadPoseEngine } from '../pose/MainThreadPoseEngine';
import type { PoseEngine } from '../pose/PoseEngine';
import { WorkerPoseEngine } from '../pose/WorkerPoseEngine';
import { requiredSquatLandmarks } from '../pose/landmarks';
import { ResearchPanel } from '../research/ResearchPanel';
import { sessionStore } from '../storage/SessionStore';
import { SquatAnalyzer } from '../squat/SquatAnalyzer';
import { AutoSetupGate } from '../squat/AutoSetupGate';
import { analysisConfig } from '../squat/analysisConfig';
import type { CalibrationStatus, PerformanceStats, PoseFrame, QualityGateResult, SquatMetrics, SquatRep, WorkoutSession } from '../types';

type Stage = 'setup' | 'workout';
type AutoPhase = 'waiting' | 'calibrating' | 'starting' | 'recording' | 'stopped';
const emptyStats: PerformanceStats = { cameraFps: 0, inferenceFps: 0, inferenceLatencyMs: 0, droppedFrames: 0 };

function guidance(quality: QualityGateResult | null, calibration: CalibrationStatus, cameraReady: boolean, stage: Stage, repCount: number, autoPhase: AutoPhase, autoProgress: number): string {
  if (stage === 'workout') return `計測中 · ${repCount} REP`;
  if (autoPhase === 'stopped') return '計測終了 · 次の計測は「再セット」から';
  if (!cameraReady) return 'カメラと姿勢モデルを準備しています…';
  if (!quality || quality.reason === 'NO_POSE') return '正面を向き、全身をカメラに映してください';
  if (quality.reason === 'LOW_VISIBILITY') return '肩・腰・膝・足首が見える位置に移動してください';
  if (quality.reason === 'OUT_OF_FRAME') return '全身を映してください';
  if (quality.reason === 'TOO_SMALL') return 'カメラに少し近づいてください';
  if (quality.reason === 'TOO_LARGE') return 'カメラから少し離れてください';
  if (quality.reason === 'NOT_FRONTAL') return 'カメラの正面を向いてください';
  if (calibration.state === 'COLLECTING') return `全身確認 · そのまま立つ · 立位測定 ${Math.round(calibration.progress * 100)}%`;
  if (autoPhase === 'starting' || calibration.state === 'CALIBRATED') return '立位測定完了 · 計測を開始しています…';
  return `全身確認 · そのまま立つ · あと${Math.ceil((1 - autoProgress) * analysisConfig.autoSetup.stableQualityMs / 1000)}秒`;
}

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const poseRef = useRef<PoseFrame | null>(null);
  const analyzerRef = useRef(new SquatAnalyzer());
  const autoGateRef = useRef(new AutoSetupGate());
  const autoArmedRef = useRef(true);
  const startWorkoutRef = useRef<() => Promise<void>>(async () => undefined);
  const ruleRef = useRef(new RuleEngine());
  const feedbackRef = useRef<FeedbackEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const savingRef = useRef<Promise<void>>(Promise.resolve());
  const runningRef = useRef(false);
  const startPendingRef = useRef(false);
  const voiceUnlockedRef = useRef(false);
  const participantIdRef = useRef('');
  const researchRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const generationRef = useRef(0);
  const lastUiRef = useRef(0);
  const lastSaveRef = useRef(0);
  const [stage, setStage] = useState<Stage>('setup');
  const [autoPhase, setAutoPhase] = useState<AutoPhase>('waiting');
  const [autoProgress, setAutoProgress] = useState(0);
  const [starting, setStarting] = useState(false);
  const [research, setResearch] = useState(() => new URLSearchParams(location.search).has('research'));
  const [participantId, setParticipantId] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceUnlocked, setVoiceUnlocked] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [engineMode, setEngineMode] = useState<'worker' | 'main' | null>(null);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [quality, setQuality] = useState<QualityGateResult | null>(null);
  const [visibility, setVisibility] = useState<number | undefined>();
  const [calibration, setCalibration] = useState<CalibrationStatus>(analyzerRef.current.calibration);
  const [metrics, setMetrics] = useState<SquatMetrics | null>(null);
  const [reps, setReps] = useState<SquatRep[]>([]);
  const [stats, setStats] = useState<PerformanceStats>(emptyStats);
  participantIdRef.current = participantId;
  researchRef.current = research;
  voiceEnabledRef.current = voiceEnabled;

  useEffect(() => {
    let active = true;
    const generation = ++generationRef.current;
    const video = videoRef.current;
    if (!video) return;
    const feedback = new FeedbackEngine({ enabled: false });
    feedbackRef.current = feedback;
    let callbackId = 0;
    let frameIsVideoCallback = false;
    let processing = false;
    let lastMediaTime = -1;
    let cameraSamples: number[] = [];
    let inferenceSamples: number[] = [];
    let droppedFrames = 0;

    const alive = () => active && generationRef.current === generation;
    const schedule = () => {
      if (!alive()) return;
      if (typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function') {
        frameIsVideoCallback = true;
        callbackId = video.requestVideoFrameCallback((_now, metadata) => frame(metadata.mediaTime));
      } else {
        frameIsVideoCallback = false;
        callbackId = requestAnimationFrame(() => frame(video.currentTime));
      }
    };
    const frame = (mediaTime: number) => {
      if (!alive()) return;
      schedule();
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || mediaTime === lastMediaTime) return;
      lastMediaTime = mediaTime;
      const now = performance.now();
      cameraSamples = cameraSamples.filter((sample) => now - sample < 1000);
      cameraSamples.push(now);
      if (processing || !engineRef.current) { droppedFrames++; return; }
      processing = true;
      const engine = engineRef.current;
      void engine.detect(video, now).then((detection) => {
        if (!alive()) return;
        inferenceSamples = inferenceSamples.filter((sample) => now - sample < 1000);
        inferenceSamples.push(performance.now());
        poseRef.current = detection.frame;
        const result = analyzerRef.current.process(detection.frame);
        let gateProgress = 0;
        if (autoArmedRef.current && !runningRef.current && !startPendingRef.current) {
          if (analyzerRef.current.calibration.state === 'IDLE') {
            const gate = autoGateRef.current.update(result.quality, now);
            gateProgress = gate.progress;
            if (gate.triggered) {
              analyzerRef.current.startCalibration();
              setAutoPhase('calibrating');
            }
          }
          if (analyzerRef.current.calibration.state === 'CALIBRATED') {
            autoArmedRef.current = false;
            setAutoPhase('starting');
            void startWorkoutRef.current();
          }
        }
        const candidates = runningRef.current ? ruleRef.current.evaluate(result.metrics) : [];
        if (!result.metrics) ruleRef.current.reset();
        const spokenType = runningRef.current && candidates.length ? feedbackRef.current?.handle(candidates, Date.now()) : null;
        if (spokenType) analyzerRef.current.noteFeedback(spokenType);
        const session = sessionRef.current;
        if (runningRef.current && session) {
          if (session.frames && result.metrics) session.frames.push({ timestamp: result.metrics.timestamp, metrics: result.metrics });
          if (result.completedRep) {
            session.reps.push(result.completedRep);
            setReps([...session.reps]);
          }
          if (result.completedRep || (session.frames && session.frames.length && now - lastSaveRef.current > 2000)) {
            lastSaveRef.current = now;
            persistSession(session);
          }
        }
        if (now - lastUiRef.current >= 140 || result.completedRep) {
          lastUiRef.current = now;
          setQuality(result.quality);
          setAutoProgress(gateProgress);
          const values = requiredSquatLandmarks.map((index) => detection.frame?.landmarks[index]?.visibility).filter((value): value is number => value !== undefined && Number.isFinite(value));
          setVisibility(values.length === requiredSquatLandmarks.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);
          setCalibration(analyzerRef.current.calibration);
          setMetrics(result.metrics);
          setStats({ cameraFps: cameraSamples.length, inferenceFps: inferenceSamples.length, inferenceLatencyMs: detection.latencyMs, droppedFrames });
        }
      }).catch(async (failure: unknown) => {
        if (!alive()) return;
        console.error('Pose inference failure', failure);
        poseRef.current = null;
        analyzerRef.current.process(null);
        autoGateRef.current.reset();
        setAutoProgress(0);
        ruleRef.current.reset();
        if (engine.mode === 'worker') {
          engine.dispose();
          try {
            const fallback = await MainThreadPoseEngine.create();
            if (!alive()) { fallback.dispose(); return; }
            engineRef.current = fallback;
            setEngineMode('main');
            setError('Workerで推論できなかったため、互換モードへ切り替えました。');
          } catch (fallbackError) {
            console.error('Main-thread fallback failure', fallbackError);
            setError('姿勢モデルまたはWASMを読み込めませんでした。ページを再読み込みしてください。');
            engineRef.current = null;
            setCameraReady(false);
            stopCamera(streamRef.current, video);
            streamRef.current = null;
          }
        } else {
          setError('姿勢推論に失敗しました。ページを再読み込みしてください。');
          engineRef.current = null;
          setCameraReady(false);
          stopCamera(streamRef.current, video);
          streamRef.current = null;
        }
      }).finally(() => { processing = false; });
    };

    const boot = async () => {
      try {
        const stream = await startCamera(video);
        if (!alive()) { stopCamera(stream, video); return; }
        streamRef.current = stream;
        let engine: PoseEngine;
        try {
          engine = await WorkerPoseEngine.create();
        } catch (workerError) {
          console.warn('Worker unavailable; trying main thread', workerError);
          engine = await MainThreadPoseEngine.create();
        }
        if (!alive()) { engine.dispose(); return; }
        engineRef.current = engine;
        setEngineMode(engine.mode);
        setCameraReady(true);
        schedule();
      } catch (failure) {
        if (!alive()) return;
        console.error('Camera or MediaPipe startup failure', failure);
        const attachedStream = video.srcObject instanceof MediaStream ? video.srcObject : streamRef.current;
        stopCamera(attachedStream, video);
        streamRef.current = null;
        setError(failure instanceof DOMException ? cameraErrorMessage(failure) : '姿勢モデルまたはWASMを読み込めませんでした。ネットワークとローカルアセットを確認してください。');
      }
    };
    void boot();
    return () => {
      active = false;
      ++generationRef.current;
      runningRef.current = false;
      if (callbackId) {
        if (frameIsVideoCallback) video.cancelVideoFrameCallback(callbackId);
        else cancelAnimationFrame(callbackId);
      }
      engineRef.current?.dispose();
      engineRef.current = null;
      const attachedStream = video.srcObject instanceof MediaStream ? video.srcObject : streamRef.current;
      stopCamera(attachedStream, video);
      streamRef.current = null;
      poseRef.current = null;
      feedback.dispose();
      feedbackRef.current = null;
      if (sessionRef.current && !sessionRef.current.endedAt) {
        sessionRef.current.endedAt = Date.now();
        const finalSnapshot = structuredClone(sessionRef.current);
        void savingRef.current.catch(() => undefined).then(() => sessionStore.save(finalSnapshot)).catch((saveError) => console.error('Session final save failed', saveError));
      }
    };
  // Camera and engine are intentionally owned by the mount lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSession(session: WorkoutSession): void {
    const snapshot = structuredClone(session);
    savingRef.current = savingRef.current.catch(() => undefined).then(() => sessionStore.save(snapshot));
    void savingRef.current.catch((failure: unknown) => {
      console.error('IndexedDB write failed', failure);
      setStorageError('解析結果を保存できませんでした。ブラウザの保存容量・設定を確認してください。');
    });
  }

  function beginCalibration(): void {
    if (!autoArmedRef.current || startPendingRef.current || runningRef.current) return;
    setError('');
    analyzerRef.current.startCalibration();
    ruleRef.current.reset();
    setAutoPhase('calibrating');
    setAutoProgress(0);
    setCalibration(analyzerRef.current.calibration);
  }

  function rearmAutoSetup(): void {
    if (startPendingRef.current || runningRef.current) return;
    analyzerRef.current.reset();
    ruleRef.current.reset();
    autoGateRef.current.reset();
    autoArmedRef.current = true;
    setAutoPhase('waiting');
    setAutoProgress(0);
    setCalibration(analyzerRef.current.calibration);
    setMetrics(null);
    setReps([]);
    setError('');
    setSaveNotice('');
  }

  function unlockVoice(): void {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setVoiceNotice('このブラウザでは音声を利用できません。計測は続けられます。');
      return;
    }
    try {
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance('音声フィードバックを有効にしました');
      utterance.lang = 'ja-JP';
      const japaneseVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('ja'));
      if (japaneseVoice) utterance.voice = japaneseVoice;
      utterance.onstart = () => {
        voiceUnlockedRef.current = true;
        setVoiceUnlocked(true);
        setVoiceNotice('音声を有効にしました。');
        feedbackRef.current?.setEnabled(voiceEnabledRef.current);
      };
      utterance.onerror = () => {
        voiceUnlockedRef.current = false;
        setVoiceUnlocked(false);
        feedbackRef.current?.setEnabled(false);
        setVoiceNotice('音声を開始できませんでした。計測は続けられます。');
      };
      window.speechSynthesis.speak(utterance);
      setVoiceNotice('音声を準備しています…');
    } catch (failure) {
      console.warn('Speech activation failed', failure);
      setVoiceNotice('音声を開始できませんでした。計測は続けられます。');
    }
  }

  async function startWorkout(): Promise<void> {
    const data = analyzerRef.current.calibration.data;
    if (runningRef.current || startPendingRef.current) return;
    if (!data || !engineRef.current || !streamRef.current) {
      autoArmedRef.current = false;
      setAutoPhase('stopped');
      setError('計測を開始できませんでした。カメラと姿勢モデルを確認してください。');
      return;
    }
    startPendingRef.current = true;
    setStarting(true);
    const generation = generationRef.current;
    setStorageError('');
    setSaveNotice('');
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      ...(participantIdRef.current.trim() ? { participantId: participantIdRef.current.trim() } : {}),
      startedAt: Date.now(),
      deviceInfo: { width: videoRef.current?.videoWidth ?? 0, height: videoRef.current?.videoHeight ?? 0 },
      calibration: data,
      reps: [],
      ...(researchRef.current ? { frames: [] } : {}),
    };
    try {
      await sessionStore.create(session);
      if (generationRef.current !== generation) {
        session.endedAt = Date.now();
        await sessionStore.save(session);
        return;
      }
      analyzerRef.current.resetWorkout();
      sessionRef.current = session;
      setReps([]);
      ruleRef.current.reset();
      feedbackRef.current?.setEnabled(voiceEnabledRef.current && voiceUnlockedRef.current);
      runningRef.current = true;
      setStage('workout');
      setAutoPhase('recording');
    } catch (failure) {
      console.error('IndexedDB session creation failed', failure);
      autoArmedRef.current = false;
      setAutoPhase('stopped');
      setStorageError('セッションを保存できません。ブラウザの保存設定を確認してください。');
    } finally {
      startPendingRef.current = false;
      if (generationRef.current === generation) setStarting(false);
    }
  }
  startWorkoutRef.current = startWorkout;

  async function stopWorkout(): Promise<void> {
    if (!runningRef.current) return;
    runningRef.current = false;
    autoArmedRef.current = false;
    setAutoPhase('stopped');
    feedbackRef.current?.setEnabled(false);
    ruleRef.current.reset();
    analyzerRef.current.resetWorkout();
    const session = sessionRef.current;
    sessionRef.current = null;
    setStage('setup');
    if (!session) return;
    session.endedAt = Date.now();
    try {
      // Try the final complete snapshot even when an earlier periodic write failed.
      await savingRef.current.catch(() => undefined);
      await sessionStore.save(structuredClone(session));
      setSaveNotice(`${session.reps.length}回の記録をこのブラウザに保存しました。`);
      setStorageError('');
    } catch (failure) {
      console.error('IndexedDB final save failed', failure);
      setStorageError('解析結果を保存できませんでした。ブラウザの保存設定・容量を確認してください。');
    }
  }

  const status = guidance(quality, calibration, cameraReady, stage, reps.length, autoPhase, autoProgress);
  const canCalibrate = cameraReady && quality?.accepted && !runningRef.current && autoPhase !== 'stopped';
  const setupProgress = autoPhase === 'waiting' ? autoProgress : calibration.progress;
  return <main className="app-shell">
    <header className="app-header">
      <div><span className="eyebrow">MOVEMENT / RESEARCH PROTOTYPE</span><h1>スクワットフォーム研究室</h1><p>正面カメラで動きを見ながら、無理のない範囲で測定します。</p></div>
      <label className="switch"><input type="checkbox" checked={research} onChange={(event) => { researchRef.current = event.target.checked; setResearch(event.target.checked); }} disabled={stage === 'workout' || starting} /> 研究モード</label>
    </header>
    <div className="app-layout">
      <section className="stage" aria-label="カメラと解析">
        <CameraView videoRef={videoRef} pose={null} poseRef={poseRef} research={research} status={status} />
        <div className="camera-foot"><span className={quality?.accepted ? 'indicator good' : 'indicator'}>{quality?.accepted ? '● 全身・正面確認（推定）' : '○ 姿勢確認中'}</span><span>推論: {engineMode === 'worker' ? 'Worker' : engineMode === 'main' ? '互換モード' : '準備中'}</span></div>
      </section>
      <aside className="control-panel">
        <div className="step-mark">{stage === 'setup' ? '01 / SETUP' : '02 / WORKOUT'}</div>
        {stage === 'setup' ? <>
          <h2>全身が映ると自動で開始</h2>
          <p>正面を向き、頭から足先まで映る位置に立ってください。画角が安定すると立位を測り、そのまま計測へ進みます。</p>
          <div className={`auto-status ${quality?.accepted ? 'good' : ''}`} role="status">{autoPhase === 'stopped' ? '自動開始は停止中です。次の計測は再セットしてください。' : autoPhase === 'calibrating' ? '立位を測定中。自然に立ったままお待ちください。' : autoPhase === 'starting' ? '立位測定が完了しました。記録を準備しています。' : quality?.accepted ? '全身を確認しました。そのまま立ってください。' : '全身と正面姿勢を確認しています。'}</div>
          {autoPhase === 'waiting' && quality?.accepted && <div className="auto-countdown" aria-label="自動開始までの待ち時間">{Math.ceil((1 - autoProgress) * analysisConfig.autoSetup.stableQualityMs / 1000)}<small>秒 · そのまま立つ</small></div>}
          {(autoPhase === 'waiting' || autoPhase === 'calibrating') && <div className="calibration-progress" role="progressbar" aria-valuenow={Math.round(setupProgress * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${setupProgress * 100}%` }} /></div>}
          <p className="step-hint">{autoPhase === 'calibrating' ? `立位測定 ${Math.round(calibration.progress * 100)}%` : autoPhase === 'waiting' ? `画角の安定待ち ${Math.round(autoProgress * 100)}%` : ''}</p>
          {autoPhase === 'stopped' ? <button className="primary-action" onClick={rearmAutoSetup}>再セットして計測</button> : <button className="secondary-action" disabled={!canCalibrate || autoPhase !== 'calibrating'} onClick={beginCalibration}>立位測定をやり直す</button>}
          <label className="field-label" htmlFor="participant">匿名参加者ID（任意）</label>
          <input id="participant" value={participantId} onChange={(event) => { participantIdRef.current = event.target.value; setParticipantId(event.target.value); }} disabled={starting} maxLength={64} placeholder="例: P-001" />
        </> : <>
          <h2>計測中</h2>
          <div className="rep-counter"><strong>{reps.length}</strong><span>REP</span></div>
          <div className="phase-pill">{metrics?.phase ?? '姿勢を確認中'}</div>
          <p>フォームの変化が続いた場合、短い日本語音声で知らせます。</p>
          <button className="primary-action stop-action" onClick={() => void stopWorkout()}>終了して保存</button>
        </>}
        {!voiceUnlocked && 'speechSynthesis' in window && <button className="secondary-action voice-activate" onClick={unlockVoice}>音声を有効にする（任意・離れる前に）</button>}
        <label className="switch voice-switch"><input type="checkbox" checked={voiceEnabled && voiceUnlocked} disabled={!voiceUnlocked} onChange={(event) => { setVoiceEnabled(event.target.checked); voiceEnabledRef.current = event.target.checked; feedbackRef.current?.setEnabled(event.target.checked); }} /> 日本語音声フィードバック{voiceUnlocked ? '' : '（有効化待ち）'}</label>
        {!voiceUnlocked && <p className="notice">音声はブラウザの操作制限があります。音声なしでも自動計測は始まります。</p>}
        {voiceNotice && <p className="notice" role="status">{voiceNotice}</p>}
        {!('speechSynthesis' in window) && <p className="notice">このブラウザは音声読み上げに対応していません。</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        {storageError && <p className="notice error" role="alert">{storageError}</p>}
        {saveNotice && <p className="notice" role="status">{saveNotice}</p>}
      </aside>
    </div>
    <ResearchPanel research={research} metrics={metrics} performance={stats} visible={visibility} />
    <footer className="app-footer">研究用プロトタイプ · 判定閾値は暫定値 · 3D膝角度は推定値です。映像は保存・送信しません。解析結果のみブラウザ内に保存します。</footer>
  </main>;
}
