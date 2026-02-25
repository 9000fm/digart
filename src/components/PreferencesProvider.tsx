"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface Preferences {
  gridCols: number;
  reducedAnimations: boolean;
}

interface PreferencesContextValue extends Preferences {
  setGridCols: (cols: number) => void;
  setReducedAnimations: (v: boolean) => void;
}

const defaults: Preferences = {
  gridCols: 5,
  reducedAnimations: false,
};

const PreferencesContext = createContext<PreferencesContextValue>({
  ...defaults,
  setGridCols: () => {},
  setReducedAnimations: () => {},
});

export const usePreferences = () => useContext(PreferencesContext);

const STORAGE_KEY = "digeart-prefs";

export default function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [gridCols, setGridColsState] = useState(defaults.gridCols);
  const [reducedAnimations, setReducedAnimationsState] = useState(defaults.reducedAnimations);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.gridCols === "number") setGridColsState(parsed.gridCols);
        if (typeof parsed.reducedAnimations === "boolean") setReducedAnimationsState(parsed.reducedAnimations);
      }
    } catch {}
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ gridCols, reducedAnimations })
      );
    } catch {}
  }, [gridCols, reducedAnimations]);

  const setGridCols = (cols: number) => {
    setGridColsState(Math.max(3, Math.min(7, cols)));
  };

  const setReducedAnimations = (v: boolean) => {
    setReducedAnimationsState(v);
  };

  return (
    <PreferencesContext.Provider
      value={{ gridCols, reducedAnimations, setGridCols, setReducedAnimations }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
