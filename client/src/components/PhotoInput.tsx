import { CircleAlert, ImagePlus, RefreshCw, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { compressImage, isAcceptedImage } from '../lib/media';
import { Spinner } from './Feedback';

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export function PhotoInput({ value, onChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!isAcceptedImage(file)) {
      setError('Please choose a JPEG, PNG or WebP photo.');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError('That photo is larger than 15 MB. Please choose a smaller one.');
      return;
    }
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch {
      setError('Could not read that photo. Try a different image.');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  const browse = () => inputRef.current?.click();

  return (
    <div className="field">
      <span className="label" id={`${inputId}-label`}>
        Photo <span className="label-opt">(optional)</span>
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-labelledby={`${inputId}-label`}
        aria-describedby={hintId}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="photo-preview fade-in">
          <img src={value} alt="Preview of your attachment" />
          <div className="photo-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={browse}
              disabled={busy}
            >
              <RefreshCw size={14} aria-hidden="true" /> Replace
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              <X size={14} aria-hidden="true" /> Remove
            </button>
          </div>
        </div>
      ) : (
        // A real button (keyboard + screen readers) that also accepts drag-and-drop.
        <button
          type="button"
          className={`dropzone${drag ? ' drag' : ''}`}
          onClick={browse}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          disabled={busy}
          aria-describedby={hintId}
          style={{ width: '100%', font: 'inherit', color: 'inherit' }}
        >
          <span className="icon-tile" aria-hidden="true">
            {busy ? <Spinner size={18} /> : <ImagePlus size={20} />}
          </span>
          <span style={{ fontWeight: 600, display: 'block' }}>
            {busy ? (
              'Optimising photo…'
            ) : (
              <>
                Drop a photo here or <strong>browse</strong>
              </>
            )}
          </span>
        </button>
      )}
      <p className="hint" id={hintId}>
        A photo helps Gemini judge severity. It’s resized on your device before upload.
      </p>
      {error && (
        <p className="field-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
