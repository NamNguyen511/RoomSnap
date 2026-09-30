"use client";

import { useRef } from "react";

type Props = {
  onPhoto: (photo: Blob) => void;
  disabled?: boolean;
};

/**
 * The options that need no camera permission: `capture` hands off to the
 * phone's own camera app, and desktops get a file picker.
 */
export function CameraCapture({ onPhoto, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same photo be picked again
    if (file) onPhoto(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={cameraRef}
        data-testid="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={libraryRef}
        data-testid="library-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        Use the phone&apos;s camera app
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => libraryRef.current?.click()}
      >
        Choose an existing photo
      </button>
    </div>
  );
}
