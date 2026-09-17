export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('このブラウザではカメラを利用できません。HTTPSまたはlocalhostで開いてください。');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OverconstrainedError') {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } else {
      throw error;
    }
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
    return stream;
  } catch (error) {
    stopCamera(stream, video);
    throw error;
  }
}

export function stopCamera(stream: MediaStream | null, video: HTMLVideoElement | null): void {
  stream?.getTracks().forEach((track) => track.stop());
  if (video && video.srcObject === stream) {
    video.pause();
    video.srcObject = null;
  }
}

export function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'カメラの使用が許可されていません。ブラウザの設定から許可してください。';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'カメラが見つかりません。接続を確認してください。';
    if (error.name === 'NotReadableError') return 'カメラを開けません。他のアプリが使用中か確認してください。';
  }
  return error instanceof Error ? error.message : 'カメラを開始できませんでした。';
}
