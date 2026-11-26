'use client';

import { useState, useEffect } from 'react';

type ViewMode = 'grid' | 'table';

export function useViewMode(key: string, defaultMode: ViewMode = 'grid'): [ViewMode, (m: ViewMode) => void] {
  const storageKey = `viewMode:${key}`;

  const [viewMode, setViewModeState] = useState<ViewMode>(defaultMode);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'grid' || stored === 'table') {
      setViewModeState(stored);
    }
  }, [storageKey]);

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
  }

  return [viewMode, setViewMode];
}
