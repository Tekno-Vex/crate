import { useState } from 'react';

interface CoverProps {
  src?: string;
  alt: string;
  size?: number | string;
  className?: string;
}

/** Album art with a graceful placeholder. Local image URI rendering is UNVERIFIED (spike S1). */
export function Cover({ src, alt, size, className }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const style = size !== undefined ? { width: size, height: size } : undefined;
  if (!src || failed) {
    return (
      <div className={`crate-cover crate-cover--empty ${className ?? ''}`} style={style} aria-label={alt}>
        <svg viewBox="0 0 24 24" width="40%" height="40%" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 12.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          />
        </svg>
      </div>
    );
  }
  return (
    <img
      className={`crate-cover ${className ?? ''}`}
      style={style}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
