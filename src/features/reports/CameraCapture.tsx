import { useEffect, useRef, useState } from "react";

/**
 * 앱 안에서 카메라로만 사진을 찍는다. (갤러리·파일 선택 없음)
 *
 * <input type="file" capture>는 기기에 따라 갤러리 선택을 허용하므로 쓰지 않고,
 * 카메라 영상(getUserMedia)의 한 장면을 캔버스로 저장한다.
 * 캔버스로 다시 만든 JPEG라서 원본 사진의 위치(GPS)·기기 정보(EXIF)도 남지 않는다.
 */

export type CapturedPhoto = { blob: Blob; url: string; capturedAt: string };

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "카메라 권한이 거부됐어요. 브라우저 설정에서 카메라를 허용해 주세요.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "사용할 수 있는 카메라가 없어요.";
  if (name === "NotReadableError") return "다른 앱이 카메라를 쓰고 있어요. 잠시 후 다시 시도해 주세요.";
  return "카메라를 열 수 없어요.";
}

export function CameraCapture({ onCapture, onClose }: { onCapture: (photo: CapturedPhoto) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("이 환경에서는 카메라를 쓸 수 없어요. (https 또는 localhost에서만 동작)");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          void video.play();
          setReady(true);
        };
      })
      .catch((caught) => !cancelled && setError(cameraErrorMessage(caught)));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      setCapturing(false);
      if (!blob) {
        setError("사진을 저장하지 못했어요. 다시 찍어 주세요.");
        return;
      }
      onCapture({ blob, url: URL.createObjectURL(blob), capturedAt: new Date().toISOString() });
    }, "image/jpeg", JPEG_QUALITY);
  };

  return (
    <div className="camera-overlay" role="dialog" aria-label="현장 사진 촬영">
      <div className="camera-top">
        <strong>현장 사진 촬영</strong>
        <button onClick={onClose} aria-label="촬영 닫기">×</button>
      </div>
      <div className="camera-view">
        <video ref={videoRef} playsInline muted />
        {!ready && !error && <p className="camera-status">카메라를 여는 중…</p>}
        {error && <p className="camera-status camera-error" role="alert">{error}</p>}
      </div>
      <p className="camera-note">갤러리 사진은 올릴 수 없어요. 지금 현장에서 찍은 사진만 첨부돼요.</p>
      <button className="camera-shutter" onClick={capture} disabled={!ready || capturing} aria-label="사진 찍기">
        <span />
      </button>
    </div>
  );
}
