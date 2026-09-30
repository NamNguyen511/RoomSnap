"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DETECTORS, detectorById } from "@/lib/detector";
import type { Detection, DetectorBackend } from "@/lib/detector/types";
import { canvasToJpeg, fileToCanvas, toDetectionCanvas } from "@/lib/image";
import { addPending, newScanId, postScan } from "@/lib/pendingScans";
import { CameraCapture } from "./CameraCapture";
import { LiveCamera } from "./LiveCamera";
import { ScanEditor } from "./ScanEditor";

type Capture = {
  /** Fixed per capture, so saving twice can't create two scans. */
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  objects: Detection[];
  detectionFailed: boolean;
  modelName: string;
};

const MODEL_STORAGE_KEY = "roomsnap:detector";

/** Capture a photo, detect objects on the device, review, then save. */
type Props = { roomId: string; roomName: string; userId: string };

export function Scanner({ roomId, roomName, userId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [live, setLive] = useState(false);
  const [backend, setBackend] = useState<DetectorBackend | null>(null);
  // Null until the saved choice has been read, so the default model isn't
  // downloaded for someone who picked the other one.
  const [detectorId, setDetectorId] = useState<string | null>(null);
  const option = detectorById(detectorId);
  const detector = option.detector;

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MODEL_STORAGE_KEY);
    } catch {
      // Storage can be blocked (private mode); fall back to the default.
    }
    setDetectorId(detectorById(stored).id);
  }, []);

  // Start downloading the model while the user is still framing the shot.
  useEffect(() => {
    if (!detectorId) return;
    let current = true;
    const chosen = detectorById(detectorId).detector;
    setBackend(chosen.backend);
    chosen
      .load()
      .then(() => current && setBackend(chosen.backend))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [detectorId]);

  function chooseDetector(id: string) {
    setDetectorId(id);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      // Not remembered, but still used for this visit.
    }
  }

  useEffect(() => {
    if (!capture) return;
    return () => URL.revokeObjectURL(capture.url);
  }, [capture]);

  async function handlePhoto(file: Blob) {
    setError(null);
    setNotice(null);
    setStatus("Preparing photo…");
    let canvas: HTMLCanvasElement;
    let blob: Blob;
    try {
      canvas = await fileToCanvas(file);
      blob = await canvasToJpeg(canvas);
    } catch {
      setStatus(null);
      setError("That file couldn't be read as a photo. Try another one.");
      return;
    }

    let objects: Detection[] = [];
    let detectionFailed = false;
    try {
      setStatus("Loading the detection model…");
      await detector.load();
      setStatus("Finding objects…");
      objects = await detector.detect(toDetectionCanvas(canvas));
    } catch {
      detectionFailed = true;
    }

    setCapture({
      id: newScanId(),
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      objects,
      detectionFailed,
      modelName: detector.name,
    });
    setStatus(null);
  }

  async function save(objects: Detection[]): Promise<string | null> {
    if (!capture) return null;
    const scan = {
      id: capture.id,
      roomId,
      width: capture.width,
      height: capture.height,
      modelName: capture.modelName,
      objects,
      image: capture.blob,
    };

    const result = await postScan(scan);
    if (result.kind === "saved") {
      router.push(`/scans/${result.id}`);
      return null;
    }
    if (result.kind === "rejected") return result.message;

    // The server can't be reached: keep the scan on this device and upload
    // it later (see PendingScans), so scanning can carry on.
    try {
      await addPending({
        ...scan,
        userId,
        roomName,
        createdAt: new Date().toISOString(),
        error: null,
      });
    } catch {
      // No storage available (e.g. private browsing): nothing to fall back on.
      return "You're offline and this browser can't store the scan. Reconnect, then save again.";
    }
    setCapture(null);
    setNotice(
      "Saved on this device. It will upload automatically when you're back online.",
    );
    return null;
  }

  if (capture) {
    return (
      <div className="flex flex-col gap-4">
        {capture.detectionFailed && (
          <p role="alert" className="card p-3 text-sm">
            Automatic detection isn&apos;t available right now (the model
            couldn&apos;t be loaded). You can still add objects by hand.
          </p>
        )}
        <ScanEditor
          key={capture.url}
          imageSrc={capture.url}
          initialObjects={capture.objects}
          saveLabel="Save scan"
          onSave={save}
        />
        <button type="button" className="btn" onClick={() => setCapture(null)}>
          Retake photo
        </button>
      </div>
    );
  }

  if (live) {
    return (
      <LiveCamera
        // The same model as the captured photo gets, so the preview shows
        // what the scan will contain.
        detector={detector}
        onCapture={(photo) => {
          setLive(false);
          handlePhoto(photo);
        }}
        onClose={() => setLive(false)}
        onUnavailable={(message) => {
          setLive(false);
          setError(message);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="btn btn-primary min-h-14 text-base"
        disabled={status !== null}
        onClick={() => {
          setError(null);
          setNotice(null);
          setLive(true);
        }}
      >
        Open live camera
      </button>
      <CameraCapture onPhoto={handlePhoto} disabled={status !== null} />
      {notice && (
        <p role="status" className="card p-3 text-center text-sm">
          {notice}
        </p>
      )}
      {status && (
        <p role="status" className="text-center text-muted">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
      <label className="card flex flex-col gap-1.5 p-3 text-sm font-medium">
        Detection model
        <select
          className="input"
          value={option.id}
          disabled={detectorId === null || status !== null}
          onChange={(e) => chooseDetector(e.target.value)}
        >
          {DETECTORS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <span className="font-normal text-muted">{option.description}</span>
        {backend && (
          <span className="font-normal text-muted" data-testid="model-backend">
            {backend === "gpu"
              ? "Running on this device's graphics chip."
              : "Running on this device's processor, which is slower. Live boxes may lag."}
          </span>
        )}
      </label>
      <p className="text-center text-sm text-muted">
        Objects are detected on your device. The photo is only uploaded when
        you save the scan.
      </p>
    </div>
  );
}
