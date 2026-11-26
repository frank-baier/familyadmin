'use client';

import { useState } from 'react';

interface EditableStarRatingProps {
  rating: number | null;
  onChange: (rating: number | null) => void | Promise<void>;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/** Interactive 5-star rating widget. Click a star to set the rating; click the active star again to clear it. */
export function EditableStarRating({ rating, onChange, size = 'sm', disabled = false }: EditableStarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const starSize = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const display = hovered ?? rating ?? 0;

  async function handleClick(e: React.MouseEvent, star: number) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || saving) return;
    const nextRating = rating === star ? null : star;
    setSaving(true);
    try {
      await onChange(nextRating);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${saving ? 'opacity-60' : ''}`}
      onClick={(e) => e.stopPropagation()}
      role="radiogroup"
      aria-label="Bewertung bearbeiten"
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled || saving}
            onClick={(e) => handleClick(e, star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            aria-label={`${star} Stern${star !== 1 ? 'e' : ''}`}
            aria-checked={rating === star}
            role="radio"
            className="focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded disabled:cursor-not-allowed"
          >
            <svg
              className={`${starSize} transition-colors ${star <= display ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </span>
  );
}
