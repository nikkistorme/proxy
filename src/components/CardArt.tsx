import { useState } from 'react';
import './CardArt.css';

interface CardArtProps {
  /** Card name: the art's alt text, and the placeholder's label. */
  name: string;
  /** URL of the card art. */
  image?: string | undefined;
}

/**
 * Card art that fills its frame (CD-6). With no image, or once the image
 * fails to load, it shows a placeholder with the card name instead. It never
 * changes the size of the frame it sits in.
 */
export function CardArt({ name, image }: CardArtProps) {
  // Remember which URL failed, so a new URL gets a fresh try.
  const [failedImage, setFailedImage] = useState<string>();

  if (image === undefined || image === failedImage) {
    return (
      <div className="card-art card-art--placeholder" role="img" aria-label={name}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 16l5-5 4 4 3-3 6 6M3 3l18 18" />
        </svg>
        <span className="card-art__name">{name}</span>
      </div>
    );
  }

  return <img className="card-art" src={image} alt={name} onError={() => setFailedImage(image)} />;
}
