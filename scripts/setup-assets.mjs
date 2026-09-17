import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmTarget = join(root, 'public/models/mediapipe');
const modelTarget = join(root, 'public/models/pose_landmarker_full.task');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

await mkdir(wasmTarget, { recursive: true });
for (const name of [
  'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm',
]) {
  await copyFile(join(wasmSource, name), join(wasmTarget, name));
}

let existing = false;
try { existing = (await stat(modelTarget)).size > 1_000_000; } catch { /* first install */ }
if (!existing) {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Pose Landmarker Full download failed: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1_000_000) throw new Error('Downloaded model is unexpectedly small');
  await writeFile(modelTarget, bytes);
}
console.log('Local Pose Landmarker Full and MediaPipe WASM assets ready.');
