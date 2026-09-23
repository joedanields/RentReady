/**
 * Read-aloud (ACCESSIBILITY §6) with the Web Speech API: Play, Pause/Resume and Stop, all
 * labelled. Uses an en-IN voice when the device has one; renders nothing where speech isn't
 * supported. Speech runs on the device — no network, nothing leaves the browser.
 */

import { useEffect, useState } from 'react';
import { t } from '../i18n';

type State = 'idle' | 'playing' | 'paused';

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;
}

export function ReadAloud({ text, what }: { text: string; what: string }) {
  const [state, setState] = useState<State>('idle');

  // Stop speaking if the card goes away (tab switch, navigation).
  useEffect(() => () => synth()?.cancel(), []);

  const speech = synth();
  if (!speech || typeof SpeechSynthesisUtterance === 'undefined') return null;

  const play = () => {
    if (state === 'paused') {
      speech.resume();
      setState('playing');
      return;
    }
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    const voice = speech.getVoices().find(v => v.lang === 'en-IN');
    if (voice) utterance.voice = voice;
    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');
    speech.speak(utterance);
    setState('playing');
  };

  const button =
    'min-h-[44px] min-w-[44px] rounded-lg border border-border px-3 text-sm font-medium text-primary';

  return (
    <div
      role="group"
      aria-label={t('readAloudLabel', { what })}
      className="mt-2 flex gap-2 print:hidden"
    >
      {state === 'playing' ? (
        <button
          type="button"
          className={button}
          onClick={() => {
            speech.pause();
            setState('paused');
          }}
        >
          {t('readAloudPause')}
        </button>
      ) : (
        <button type="button" className={button} onClick={play}>
          {t('readAloudPlay')}
        </button>
      )}
      {state !== 'idle' && (
        <button
          type="button"
          className={button}
          onClick={() => {
            speech.cancel();
            setState('idle');
          }}
        >
          {t('readAloudStop')}
        </button>
      )}
    </div>
  );
}
