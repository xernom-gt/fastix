import { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../services/apiClient';

interface VenueImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  ariaHidden?: boolean;
  tone?: 'light' | 'dark';
  compact?: boolean;
}

export function VenueImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  width,
  height,
  loading,
  fetchPriority,
  ariaHidden = false,
  tone = 'light',
  compact = false,
}: VenueImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || hasError) {
    const toneClasses =
      tone === 'dark' ? 'bg-[#111827] text-gray-400' : 'bg-gray-100 text-gray-600';

    return (
      <div
        aria-hidden={ariaHidden || undefined}
        className={`w-full h-full shrink-0 flex flex-col items-center justify-center gap-1.5 select-none ${toneClasses}`}
      >
        <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
          landscape
        </span>
        {!compact && !ariaHidden && (
          <span className="text-[11px] font-medium px-3 text-center">Foto belum tersedia</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={ariaHidden ? '' : alt}
      width={width}
      height={height}
      loading={loading}
      fetchPriority={fetchPriority}
      aria-hidden={ariaHidden || undefined}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
