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

function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
  ];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const hasBrowserSTT = !!getRecognitionCtor();
    const hasCloudCapture =
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);
    const hasSTT = hasBrowserSTT || hasCloudCapture;
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
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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

  const browserListen = useCallback(
    (timeoutMs = 17000): Promise<string> =>
      new Promise((resolve) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
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

  const cloudListen = useCallback(
    async (timeoutMs = 17000): Promise<string | null> => {
      if (
        typeof window === 'undefined' ||
        typeof MediaRecorder === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return null;
      }

      let stream: MediaStream | null = null;
      let browserFallback = '';
      let browserRec: SpeechRecognitionLike | null = null;
      let browserSilenceTimer: ReturnType<typeof setTimeout> | undefined;
      let hardStopTimer: ReturnType<typeof setTimeout> | undefined;

      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        mediaStreamRef.current = stream;

        const mimeType = preferredRecordingMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];

        const recorded = new Promise<Blob>((resolve) => {
          recorder.ondataavailable = (event) => {
            if (event.data?.size) chunks.push(event.data);
          };
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
          };
        });

        const stopRecorder = () => {
          if (hardStopTimer) clearTimeout(hardStopTimer);
          if (browserSilenceTimer) clearTimeout(browserSilenceTimer);
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            /* ignore */
          }
          try { browserRec?.stop(); } catch { /* ignore */ }
        };

        // Use browser STT only as an end-of-speech detector and emergency fallback.
        const Ctor = getRecognitionCtor();
        if (Ctor) {
          browserRec = new Ctor();
          browserRec.lang = lang;
          browserRec.interimResults = true;
          browserRec.continuous = true;
          browserRec.maxAlternatives = 3;
          recognitionRef.current = browserRec;
          browserRec.onresult = (event: any) => {
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const text = bestTranscript(res);
              if (!text) continue;
              if (res.isFinal) browserFallback = `${browserFallback} ${text}`.trim();
              else interimText = `${interimText} ${text}`.trim();
            }
            setInterim(interimText || browserFallback);
            if (browserSilenceTimer) clearTimeout(browserSilenceTimer);
            if (browserFallback) browserSilenceTimer = setTimeout(stopRecorder, 1250);
          };
          browserRec.onerror = () => {
            // Chirp recording continues even if browser recognition is unavailable.
          };
          browserRec.onend = () => {
            if (browserFallback) stopRecorder();
          };
        }

        setListening(true);
        setInterim('Listening…');
        recorder.start(250);
        try { browserRec?.start(); } catch { /* ignore */ }
        hardStopTimer = setTimeout(stopRecorder, Math.min(timeoutMs, 12000));

        const blob = await recorded;
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recognitionRef.current = null;
        setListening(false);
        setInterim('Understanding…');

        if (!blob.size) return browserFallback || '';
        const audio = await blobToBase64(blob);
        const response = await fetch('/api/speech/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio, language: lang, mimeType: blob.type }),
        });
        const data = await response.json().catch(() => ({}));
        setInterim('');

        if (response.ok && data?.success && typeof data.transcript === 'string' && data.transcript.trim()) {
          setMicError('');
          return data.transcript.trim();
        }

        // When Google STT is not configured yet, preserve the same spoken turn using browser STT.
        if (browserFallback) return browserFallback.trim();
        return null;
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setListening(false);
        setInterim('');
        if (browserFallback) return browserFallback.trim();
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setMicError('not-allowed');
        }
        return null;
      } finally {
        if (hardStopTimer) clearTimeout(hardStopTimer);
        if (browserSilenceTimer) clearTimeout(browserSilenceTimer);
        try { browserRec?.abort(); } catch { /* ignore */ }
      }
    },
    [lang]
  );

  const listen = useCallback(
    async (timeoutMs = 17000): Promise<string> => {
      const cloudResult = await cloudListen(timeoutMs);
      if (cloudResult !== null) return cloudResult;
      return browserListen(timeoutMs);
    },
    [browserListen, cloudListen]
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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
