import type { PhotoCredit } from '../lib/types';

/** Photo with caption and (for openly licensed demo photos) attribution. */
export function PhotoFigure({
  src,
  alt,
  label,
  tone = 'neutral',
  credit,
}: {
  src: string;
  alt: string;
  label: string;
  tone?: 'neutral' | 'green';
  credit?: PhotoCredit | null;
}) {
  return (
    <figure className="photo-fig">
      <div className="photo-frame">
        <img src={src} alt={alt} loading="lazy" decoding="async" />
        <span className={`photo-tag ${tone}`}>{label}</span>
      </div>
      {credit && (
        <figcaption className="xs muted">
          Photo:{' '}
          <a href={credit.source} target="_blank" rel="noopener noreferrer">
            {credit.author}
          </a>{' '}
          · {credit.license} · Wikimedia Commons
        </figcaption>
      )}
    </figure>
  );
}
