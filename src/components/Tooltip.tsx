"use client";

import { useRef, useLayoutEffect, useState, type ReactNode } from "react";

export default function Tooltip({ label, children, position = "top", className, show, hoverable = true }: { label: string; children: ReactNode; position?: "top" | "bottom" | "left" | "right"; className?: string; show?: boolean; hoverable?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [shiftX, setShiftX] = useState(0);
  const isHorizontal = position === "top" || position === "bottom";

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip || !isHorizontal) return;

    // Measure where the tooltip *would* be if centered on the parent
    const wrapRect = wrap.getBoundingClientRect();
    const tipWidth = tip.scrollWidth;
    const centerX = wrapRect.left + wrapRect.width / 2;
    const tipLeft = centerX - tipWidth / 2;
    const tipRight = centerX + tipWidth / 2;
    const pad = 8;

    let shift = 0;
    if (tipRight > window.innerWidth - pad) {
      shift = window.innerWidth - pad - tipRight;
    } else if (tipLeft < pad) {
      shift = pad - tipLeft;
    }
    setShiftX(shift);
  }, [label, isHorizontal]);

  const positionBase = {
    top: "bottom-full left-1/2 mb-2",
    bottom: "top-full left-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const translateStyle = isHorizontal
    ? { transform: `translateX(calc(-50% + ${shiftX}px))` }
    : undefined;

  return (
    <div ref={wrapRef} className="relative group/tip">
      {children}
      <div
        ref={tipRef}
        style={translateStyle}
        className={`absolute ${positionBase[position]} px-2.5 py-1 bg-[var(--text)] text-[var(--bg)] rounded-md font-mono text-[11px] whitespace-nowrap pointer-events-none ${hoverable ? "group-hover/tip:opacity-100" : ""} transition-opacity duration-150 z-50 ${show ? "opacity-100" : "opacity-0"}${className ? ` ${className}` : ""}`}
      >
        {label}
      </div>
    </div>
  );
}
