"use client";

import { useState } from "react";
import { colorForLabel, countByLabel } from "@/lib/labels";
import type { KeyedDetection } from "./BoxOverlay";

export const LABEL_DATALIST_ID = "label-suggestions";

type Props = {
  objects: KeyedDetection[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onRelabel: (key: string, label: string) => void;
  onDelete: (key: string) => void;
};

function RenameForm({
  object,
  onRelabel,
  onDelete,
}: {
  object: KeyedDetection;
  onRelabel: (label: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(object.label);
  return (
    <form
      className="flex flex-wrap gap-2 px-3 pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) onRelabel(label.trim());
      }}
    >
      <input
        className="input min-w-0 flex-1"
        aria-label="Object name"
        list={LABEL_DATALIST_ID}
        maxLength={60}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button
        className="btn"
        disabled={!label.trim() || label.trim() === object.label}
      >
        Rename
      </button>
      <button type="button" className="btn btn-danger" onClick={onDelete}>
        Remove
      </button>
    </form>
  );
}

export function ObjectList({
  objects,
  selectedKey,
  onSelect,
  onRelabel,
  onDelete,
}: Props) {
  if (objects.length === 0) {
    return (
      <p className="card p-4 text-sm text-muted">
        No objects yet. The model recognises about 80 everyday things (chairs,
        couches, beds, tables, TVs, plants…) but not lamps, shelves or rugs.
        Use <span className="font-medium text-foreground">Add object</span> to
        mark anything it missed.
      </p>
    );
  }

  const sorted = [...objects].sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      (b.confidence ?? 0) - (a.confidence ?? 0),
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Object counts">
        {countByLabel(objects).map(({ label, count }) => (
          <li key={label} className="chip" data-testid="label-count">
            {label} × {count}
          </li>
        ))}
      </ul>
      <ul className="card divide-y divide-border" aria-label="Objects">
        {sorted.map((o) => {
          const selected = o.key === selectedKey;
          return (
            <li key={o.key} className={selected ? "bg-accent-soft" : ""}>
              <button
                type="button"
                data-testid="object-row"
                aria-expanded={selected}
                onClick={() => onSelect(selected ? null : o.key)}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: colorForLabel(o.label) }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {o.label}
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {o.confidence === null
                    ? "added by hand"
                    : `${Math.round(o.confidence * 100)}% sure`}
                </span>
              </button>
              {selected && (
                <RenameForm
                  object={o}
                  onRelabel={(label) => onRelabel(o.key, label)}
                  onDelete={() => onDelete(o.key)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
