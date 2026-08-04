import React, { useEffect, useState } from 'react';
import { getContentImageUrl } from '../services/contentImages';

interface ContentImageProps {
  /** Storage path from services/contentImages.ts (e.g. plantMainImagePath(id)). */
  path: string;
  alt: string;
  /** Rendered while no real image exists yet at `path` — today's emoji/icon look. */
  fallback: React.ReactNode;
  className?: string;
}

/**
 * Shows a real content image if one has been uploaded at `path`
 * (content-images/... in Storage), otherwise renders `fallback` unchanged —
 * so every Academy article and Encyclopedia plant already works today
 * (emoji/gradient) and upgrades itself automatically the moment a real photo
 * is uploaded, with no code change needed at the call site.
 */
const ContentImage: React.FC<ContentImageProps> = ({ path, alt, fallback, className }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    getContentImageUrl(path).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
};

export default ContentImage;
