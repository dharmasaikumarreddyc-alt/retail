'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function bestTranscript(result: any): string {
  if (!result?.length) return '';
  const choices = Array.from({ length: result.length }, (_, i) => result[i])
    .map((choice: any) => ({
      transcript: String(choice?.transcript ?? '').trim(),
      confidence: Number.isFinite(choice?.confidence) ? Number(choice.confidence) : 0,
    }))
    .filter((choice) => choice.transcript);

  if (!choices.length) return '';
  choices.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.transcript.length - a.transcript.length;
  });
  return choices[0].transcript;
}

export function useVoice(lang = 'en-IN') {
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState<string>('');
  const [interim, setInterim] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const hasSTT = !!getRecognitionCtor();
    const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setSupported(hasSTT && hasTTS);
    setTtsSupported(hasTTS);
    setSttSupported(hasSTT);

    if (hasTTS) {
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return;
        voiceRef.current =
          voices.find((v) => /en[-_]IN/i.test(v.lang)) ||
          voices.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|zira|aria|jenny|google/i.test(v.name)) ||
          voices.find((v) => /en[-_]US/i.test(v.lang)) ||
          voices.find((v) => /^en/i.test(v.lang)) ||
          voices[0];
      };
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }

    return () => {
      try {
        recognitionRef.current?.abort();
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1;
        if (voiceRef.current) utterance.voice = voiceRef.current;
        utterance.onstart = () => setSpeaking(true);
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          setSpeaking(false);
          resolve();
        };
        utterance.onend = done;
        utterance.onerror = done;

        const speakNow = () => {
          try {
            synth.resume();
          } catch {
            /* ignore */
          }
          synth.speak(utterance);
        };

        if (synth.speaking || synth.pending) {
          synth.cancel();
          setTimeout(speakNow, 180);
        } else {
          speakNow();
        }

        setTimeout(done, Math.min(15000, 1800 + text.length * 90));
      }),
    [lang]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const listen = useCallback(
    (timeoutMs = 17000): Promise<string> =>
      new Promise((resolve) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
          setMicError('unsupported');
          resolve('');
          return;
        }
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
        try {
          recognitionRef.current?.abort();
        } catch {
          /* ignore */
        }

        let settled = false;
        let finalText = '';
        let current: SpeechRecognitionLike | null = null;
        const deadline = Date.now() + timeoutMs;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        let silenceTimer: ReturnType<typeof setTimeout> | undefined;

        const done = (value: string) => {
          if (settled) return;
          settled = true;
          if (killTimer) clearTimeout(killTimer);
          if (silenceTimer) clearTimeout(silenceTimer);
          try { current?.stop(); } catch { /* ignore */ }
          setListening(false);
          setInterim('');
          recognitionRef.current = null;
          resolve(value.trim());
        };

        const arm = () => {
          if (settled) return;
          const rec = new Ctor();
          current = rec;
          rec.lang = lang;
          rec.interimResults = true;
          rec.continuous = true;
          rec.maxAlternatives = 3;
          recognitionRef.current = rec;

          rec.onresult = (event: any) => {
            let interimStr = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const txt = bestTranscript(res);
              if (!txt) continue;
              if (res.isFinal) finalText = `${finalText} ${txt}`.trim();
              else interimStr = `${interimStr} ${txt}`.trim();
            }
            setMicError('');
            setInterim(interimStr || finalText);
            if (silenceTimer) clearTimeout(silenceTimer);
            // Slightly longer pause helps Indian-English names and multi-word merchant names finish cleanly.
            if (finalText) silenceTimer = setTimeout(() => done(finalText), 1200);
          };

          rec.onerror = (event: any) => {
            const err = event?.error;
            if (err && err !== 'no-speech' && err !== 'aborted') {
              setMicError(err);
              done(finalText);
            }
          };

          rec.onend = () => {
            if (settled) return;
            if (finalText) done(finalText);
            else if (Date.now() < deadline) setTimeout(arm, 150);
            else done('');
          };

          try {
            rec.start();
          } catch {
            setTimeout(() => {
              if (!settled) done(finalText);
            }, 0);
          }
        };

        setListening(true);
        setInterim('');
        arm();
        killTimer = setTimeout(() => done(finalText), timeoutMs);
      }),
    [lang]
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const askAndListen = useCallback(
    async (prompt: string, timeoutMs = 16000): Promise<string> => {
      await speak(prompt);
      await new Promise((r) => setTimeout(r, 350));
      return listen(timeoutMs);
    },
    [speak, listen]
  );

  return {
    supported,
    ttsSupported,
    sttSupported,
    listening,
    speaking,
    micError,
    interim,
    clearMicError: () => setMicError(''),
    unlockAudio,
    speak,
    stopSpeaking,
    listen,
    stopListening,
    askAndListen,
  };
}

export function interpretYesNo(transcript: string): 'yes' | 'no' | 'unknown' {
  const t = transcript.toLowerCase().trim();
  if (!t) return 'unknown';
  if (/\b(yes|yeah|yep|yup|sure|confirm|confirmed|ok|okay|place( the)? order|go ahead|do it|proceed|correct|perfect|sounds good)\b/.test(t))
    return 'yes';
  if (/\b(no|nope|cancel|stop|don't|do not|wait|change|nah)\b/.test(t)) return 'no';
  return 'unknown';
}
