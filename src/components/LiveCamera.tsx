"use client";

import { useEffect, useRef, useState } from "react";
import type { Detection, Detector } from "@/lib/detector/types";
import { canvasToJpeg, toDetectionCanvas } from "@/lib/image";
import { colorForLabel } from "@/lib/labels";

const RETRY_AFTER_FAILURE_MS = 3000;
const TAKE_PHOTO_TIMEOUT_MS = 4000;
const PREVIEW_MAX_HEIGHT = "70dvh";

type Props = {
  /** Runs on preview frames back to back; a slow model means laggy boxes. */
  detector: Detector;
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  /** The camera could not be used; the message says why. */
  onUnavailable: (message: string) => void;
};

// Chrome on Android can take a full-resolution still through the camera's
// photo pipeline. Safari has no ImageCapture, so there we keep a video frame.
type ImageCaptureCtor = new (track: MediaStreamTrack) => {
  takePhoto(): Promise<Blob>;
};

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access is blocked. Allow the camera for this site in your browser settings, or use the options below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device. Use the options below instead.";
  }
  return "The camera couldn't be started. Use the options below instead.";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const percent = (n: number) => `${n * 100}%`;

/** Camera preview with boxes drawn on what the model currently sees. */
export function LiveCamera({ detector, onCapture, onClose, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onUnavailableRef = useRef(onUnavailable);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [boxes, setBoxes] = useState<Detection[]>([]);
  const [runs, setRuns] = useState(0);
  const [detecting, setDetecting] = useState<"loading" | "on" | "failed">("loading");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  // Start the rear camera; always release it when the preview goes away.
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start() {
      // Browsers only expose the camera on HTTPS (or localhost).
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailableRef.current(
          "The live camera needs a secure (HTTPS) connection. Use the options below instead.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (err) {
        if (!cancelled) onUnavailableRef.current(cameraErrorMessage(err));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Detect on the latest frame, one run at a time, as fast as the model allows.
  useEffect(() => {
    if (!size) return;
    let stopped = false;
    let frameRequest = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");

    async function detectFrame() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const found = await detector.detect(toDetectionCanvas(video, canvas));
          if (stopped) return;
          setBoxes(found);
          setRuns((n) => n + 1);
          setDetecting("on");
        } catch {
          if (stopped) return;
          // The model couldn't load (e.g. offline before it was cached). The
          // camera still works; try again shortly rather than every frame.
          setBoxes([]);
          setDetecting("failed");
          retryTimer = setTimeout(detectFrame, RETRY_AFTER_FAILURE_MS);
          return;
        }
      }
      // Paused by the browser while the tab is hidden, which saves battery.
      frameRequest = requestAnimationFrame(detectFrame);
    }

    detectFrame();
    return () => {
      stopped = true;
      cancelAnimationFrame(frameRequest);
      clearTimeout(retryTimer);
    };
  }, [size, detector]);

  function updateSize() {
    const video = videoRef.current;
    if (video?.videoWidth) {
      setSize({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !size) return;
    setCapturing(true);

    let photo: Blob | null = null;
    const track = streamRef.current?.getVideoTracks()[0];
    const ImageCapture = (window as unknown as { ImageCapture?: ImageCaptureCtor })
      .ImageCapture;
    if (track && ImageCapture) {
      photo = await withTimeout(
        new ImageCapture(track).takePhoto(),
        TAKE_PHOTO_TIMEOUT_MS,
      ).catch(() => null);
    }
    if (!photo) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      photo = await canvasToJpeg(canvas, 0.92).catch(() => null);
    }

    if (photo) {
      onCapture(photo);
    } else {
      setCapturing(false);
      onUnavailableRef.current("The photo couldn't be taken. Use the options below instead.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        data-testid="live-preview"
        data-detection-runs={runs}
        className="relative mx-auto w-full overflow-hidden rounded-xl bg-black"
        style={
          size
            ? {
                aspectRatio: `${size.width} / ${size.height}`,
                // Keep tall portrait previews on screen without cropping, so
                // the boxes stay aligned with the picture.
                maxWidth: `calc(${PREVIEW_MAX_HEIGHT} * ${size.width / size.height})`,
              }
            : { aspectRatio: "3 / 4" }
        }
      >
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
          autoPlay
          onLoadedMetadata={updateSize}
          onResize={updateSize}
        />
        {boxes.map((o, i) => {
          const color = colorForLabel(o.label);
          return (
            <div
              key={i}
              data-testid="live-box"
              className="pointer-events-none absolute"
              style={{
                left: percent(o.x),
                top: percent(o.y),
                width: percent(o.w),
                height: percent(o.h),
                border: `2px solid ${color}`,
              }}
            >
              <span
                className="absolute top-0 left-0 max-w-full truncate px-1 py-px text-[11px] leading-4 font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {o.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted">
        {!size
          ? "Starting the camera…"
          : detecting === "loading"
            ? "Loading live detection…"
            : detecting === "failed"
              ? "Live boxes aren't available right now. You can still capture."
              : "Aim at the room. The captured photo is analysed again in full detail."}
      </p>

      <button
        type="button"
        className="btn btn-primary min-h-14 text-base"
        disabled={!size || capturing}
        onClick={capture}
      >
        {capturing ? "Capturing…" : "Capture"}
      </button>
      <button type="button" className="btn" disabled={capturing} onClick={onClose}>
        Close camera
      </button>
    </div>
  );
}
