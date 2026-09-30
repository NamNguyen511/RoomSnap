"use client";

import { useRef, useState } from "react";
import type { Detection } from "@/lib/detector/types";
import { colorForLabel } from "@/lib/labels";

export type Box = Pick<Detection, "x" | "y" | "w" | "h">;
export type KeyedDetection = Detection & { key: string };

// Ignore accidental taps while drawing: a box must cover at least 2% each way.
const MIN_DRAWN_SIZE = 0.02;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const percent = (n: number) => `${n * 100}%`;

type Props = {
  imageSrc: string;
  objects: KeyedDetection[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** When true, dragging on the photo draws a new box instead of selecting. */
  drawing: boolean;
  onDraw: (box: Box) => void;
  /** A drawn box that is waiting for a name. */
  pendingBox: Box | null;
};

export function BoxOverlay({
  imageSrc,
  objects,
  selectedKey,
  onSelect,
  drawing,
  onDraw,
  pendingBox,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  function pointFromEvent(e: React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  function boxTo(point: { x: number; y: number }): Box {
    const start = startRef.current!;
    return {
      x: round4(Math.min(start.x, point.x)),
      y: round4(Math.min(start.y, point.y)),
      w: round4(Math.abs(point.x - start.x)),
      h: round4(Math.abs(point.y - start.y)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = pointFromEvent(e);
    setDraft({ ...startRef.current, w: 0, h: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    setDraft(boxTo(pointFromEvent(e)));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const box = boxTo(pointFromEvent(e));
    startRef.current = null;
    setDraft(null);
    if (box.w >= MIN_DRAWN_SIZE && box.h >= MIN_DRAWN_SIZE) onDraw(box);
  }

  function handlePointerCancel() {
    startRef.current = null;
    setDraft(null);
  }

  // Largest first, so small boxes sit on top and stay tappable.
  const ordered = [...objects].sort((a, b) => b.w * b.h - a.w * a.h);
  const outline = draft ?? pendingBox;

  return (
    <div
      ref={containerRef}
      data-testid="box-overlay"
      className={`relative overflow-hidden rounded-xl border border-border select-none ${
        drawing ? "cursor-crosshair touch-none" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => {
        if (!drawing && e.target === e.currentTarget.firstElementChild) {
          onSelect(null);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: and auth-protected sources */}
      <img
        src={imageSrc}
        alt="Room photo"
        draggable={false}
        className="block h-auto w-full"
      />
      {ordered.map((o) => {
        const color = colorForLabel(o.label);
        const selected = o.key === selectedKey;
        return (
          <button
            key={o.key}
            type="button"
            data-testid="object-box"
            aria-label={`${o.label}, select`}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : o.key)}
            className={`absolute ${drawing ? "pointer-events-none" : ""}`}
            style={{
              left: percent(o.x),
              top: percent(o.y),
              width: percent(o.w),
              height: percent(o.h),
              border: `${selected ? 3 : 2}px solid ${color}`,
              backgroundColor: selected ? `${color}33` : "transparent",
            }}
          >
            <span
              className="absolute top-0 left-0 max-w-full truncate px-1 py-px text-[11px] leading-4 font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {o.label}
            </span>
          </button>
        );
      })}
      {outline && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-white bg-white/20 outline outline-1 outline-black/60"
          style={{
            left: percent(outline.x),
            top: percent(outline.y),
            width: percent(outline.w),
            height: percent(outline.h),
          }}
        />
      )}
    </div>
  );
}
