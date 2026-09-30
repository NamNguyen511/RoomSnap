"use client";

import { useRef, useState } from "react";
import type { Detection } from "@/lib/detector/types";
import { LABEL_SUGGESTIONS } from "@/lib/labels";
import { type Box, BoxOverlay, type KeyedDetection } from "./BoxOverlay";
import { LABEL_DATALIST_ID, ObjectList } from "./ObjectList";

type Props = {
  imageSrc: string;
  initialObjects: Detection[];
  saveLabel: string;
  /** Saved scans: only offer Save once something has been edited. */
  requireChanges?: boolean;
  /** Resolves to an error message, or null when the save succeeded. */
  onSave: (objects: Detection[]) => Promise<string | null>;
};

const stripKey = (o: KeyedDetection): Detection => ({
  label: o.label,
  confidence: o.confidence,
  x: o.x,
  y: o.y,
  w: o.w,
  h: o.h,
  source: o.source,
});
const snapshot = (objects: KeyedDetection[]) =>
  JSON.stringify(objects.map(stripKey));

/** Photo with boxes plus an editable object list: relabel, remove, draw to add. */
export function ScanEditor({
  imageSrc,
  initialObjects,
  saveLabel,
  requireChanges = false,
  onSave,
}: Props) {
  const nextKey = useRef(0);
  const newKey = () => `o${nextKey.current++}`;

  const [objects, setObjects] = useState<KeyedDetection[]>(() =>
    initialObjects.map((o) => ({ ...o, key: newKey() })),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(objects));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pendingBox, setPendingBox] = useState<Box | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = snapshot(objects) !== savedSnapshot;

  function relabel(key: string, label: string) {
    // A renamed object no longer carries the model's confidence in the old name.
    setObjects((prev) =>
      prev.map((o) =>
        o.key === key ? { ...o, label, confidence: null, source: "manual" } : o,
      ),
    );
  }

  function remove(key: string) {
    setObjects((prev) => prev.filter((o) => o.key !== key));
    setSelectedKey(null);
  }

  function cancelAdd() {
    setDrawing(false);
    setPendingBox(null);
    setPendingLabel("");
  }

  function confirmAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = pendingLabel.trim();
    if (!pendingBox || !label) return;
    const key = newKey();
    setObjects((prev) => [
      ...prev,
      { ...pendingBox, label, confidence: null, source: "manual", key },
    ]);
    setSelectedKey(key);
    cancelAdd();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const taken = snapshot(objects);
    const message = await onSave(objects.map(stripKey));
    if (message) {
      setError(message);
      setSaving(false);
      return;
    }
    setSavedSnapshot(taken);
    // A new scan navigates away once saved: leave the button disabled until
    // then, or a second tap would upload the same scan again.
    if (requireChanges) setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <BoxOverlay
        imageSrc={imageSrc}
        objects={objects}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        drawing={drawing && !pendingBox}
        onDraw={setPendingBox}
        pendingBox={pendingBox}
      />

      {pendingBox ? (
        <form className="card flex flex-wrap gap-2 p-3" onSubmit={confirmAdd}>
          <input
            className="input min-w-0 flex-1"
            aria-label="Name of the new object"
            placeholder="What is it? e.g. lamp"
            list={LABEL_DATALIST_ID}
            maxLength={60}
            autoFocus
            value={pendingLabel}
            onChange={(e) => setPendingLabel(e.target.value)}
          />
          <button className="btn btn-primary" disabled={!pendingLabel.trim()}>
            Add
          </button>
          <button type="button" className="btn" onClick={cancelAdd}>
            Cancel
          </button>
        </form>
      ) : drawing ? (
        <div className="card flex items-center justify-between gap-3 p-3 text-sm">
          <p>Drag on the photo to draw a box around the object.</p>
          <button type="button" className="btn shrink-0" onClick={cancelAdd}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {objects.length} {objects.length === 1 ? "object" : "objects"}
          </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelectedKey(null);
              setDrawing(true);
            }}
          >
            Add object
          </button>
        </div>
      )}

      <ObjectList
        objects={objects}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onRelabel={relabel}
        onDelete={remove}
      />

      <datalist id={LABEL_DATALIST_ID}>
        {LABEL_SUGGESTIONS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {(!requireChanges || dirty) && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      )}
    </div>
  );
}
