import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not yet in lib.dom). */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGS = [
  { code: 'en-IN', label: 'English' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
];

/** Dictate the complaint in English, Tamil or Hindi — Gemini translates and classifies it. */
export function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const [supported] = useState(() => typeof window !== 'undefined' && getRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('en-IN');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r?.isFinal) text += r[0].transcript;
      }
      if (text.trim()) onText(text.trim());
    };
    rec.onerror = (e) =>
      setError(
        e.error === 'not-allowed' ? 'Microphone permission denied.' : 'Voice input stopped.',
      );
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }

  return (
    <div className="row" style={{ gap: '0.5rem' }}>
      <label className="sr-only" htmlFor="voice-lang">
        Voice input language
      </label>
      <select
        id="voice-lang"
        className="select"
        style={{ width: 'auto', height: 36, fontSize: '0.85rem' }}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`btn btn-sm ${listening ? 'btn-primary' : 'btn-soft'}`}
        onClick={toggle}
        aria-pressed={listening}
      >
        {listening ? <Square size={14} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
        {listening ? 'Stop' : 'Speak'}
      </button>
      <span aria-live="polite" className="xs muted">
        {listening ? 'Listening…' : (error ?? '')}
      </span>
    </div>
  );
}
