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
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
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
        if (vadFrameRef.current !== null) cancelAnimationFrame(vadFrameRef.current);
        void audioContextRef.current?.close();
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.resume();
      // Create/resume the Web Audio context while we are still inside the user's
      // initial tap. iOS may block a brand-new context on later hands-free turns.
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor && (!audioContextRef.current || audioContextRef.current.state === 'closed')) {
        audioContextRef.current = new AudioContextCtor();
      }
      void audioContextRef.current?.resume();
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
        utterance.rate = 1.05;
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
          try { synth.resume(); } catch { /* ignore */ }
          synth.speak(utterance);
        };

        if (synth.speaking || synth.pending) {
          synth.cancel();
          setTimeout(speakNow, 120);
        } else {
          speakNow();
        }

        setTimeout(done, Math.min(12000, 1200 + text.length * 70));
      }),
    [lang]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const browserListen = useCallback(
    (timeoutMs = 9000): Promise<string> =>
      new Promise((resolve) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
          resolve('');
          return;
        }
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { /* ignore */ }

        let settled = false;
        let finalText = '';
        let current: SpeechRecognitionLike | null = null;
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

        const rec = new Ctor();
        current = rec;
        rec.lang = lang;
        rec.interimResults = true;
        rec.continuous = !/iPhone|iPad|iPod/i.test(navigator.userAgent);
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
          if (finalText) silenceTimer = setTimeout(() => done(finalText), 700);
        };

        rec.onerror = (event: any) => {
          const err = event?.error;
          if (err && err !== 'no-speech' && err !== 'aborted') setMicError(err);
          if (err !== 'no-speech') done(finalText);
        };
        rec.onend = () => done(finalText);

        setListening(true);
        setInterim('Listening…');
        try { rec.start(); } catch { done(''); }
        killTimer = setTimeout(() => done(finalText), timeoutMs);
      }),
    [lang]
  );

  const cloudListen = useCallback(
    async (timeoutMs = 9000): Promise<string | null> => {
      if (
        typeof window === 'undefined' ||
        typeof MediaRecorder === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return null;
      }

      let stream: MediaStream | null = null;
      let hardStopTimer: ReturnType<typeof setTimeout> | undefined;
      let source: MediaStreamAudioSourceNode | null = null;
      let analyser: AnalyserNode | null = null;

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
          recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }));
        });

        let stopped = false;
        const stopRecorder = () => {
          if (stopped) return;
          stopped = true;
          if (hardStopTimer) clearTimeout(hardStopTimer);
          if (vadFrameRef.current !== null) {
            cancelAnimationFrame(vadFrameRef.current);
            vadFrameRef.current = null;
          }
          try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* ignore */ }
        };

        setListening(true);
        setInterim('Listening…');
        recorder.start(200);

        // Single-mic design: MediaRecorder captures the audio and this Web Audio
        // analyser reads the SAME stream for end-of-speech detection. We never run
        // webkitSpeechRecognition concurrently with MediaRecorder on iPhone.
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        let audioContext = audioContextRef.current;
        if (AudioContextCtor && (!audioContext || audioContext.state === 'closed')) {
          audioContext = new AudioContextCtor();
          audioContextRef.current = audioContext;
        }
        if (audioContext) {
          try { await audioContext.resume(); } catch { /* context was already unlocked if iOS requires it */ }
          source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.15;
          source.connect(analyser);

          const samples = new Uint8Array(analyser.fftSize);
          const startedAt = performance.now();
          let lastVoiceAt = startedAt;
          let voiceFrames = 0;
          let heardSpeech = false;

          const checkVoice = () => {
            if (stopped || !analyser) return;
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
              const normalized = (samples[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / samples.length);
            const now = performance.now();

            if (rms > 0.018) {
              voiceFrames += 1;
              lastVoiceAt = now;
              if (voiceFrames >= 3) heardSpeech = true;
            } else if (!heardSpeech) {
              voiceFrames = Math.max(0, voiceFrames - 1);
            }

            if (heardSpeech && now - lastVoiceAt > 700 && now - startedAt > 450) {
              stopRecorder();
              return;
            }
            vadFrameRef.current = requestAnimationFrame(checkVoice);
          };
          vadFrameRef.current = requestAnimationFrame(checkVoice);
        }

        hardStopTimer = setTimeout(stopRecorder, Math.min(timeoutMs, 8000));
        const blob = await recorded;

        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        try { source?.disconnect(); } catch { /* ignore */ }
        try { analyser?.disconnect(); } catch { /* ignore */ }
        // Keep audioContextRef alive for the next hands-free turn on iPhone.

        setListening(false);
        setInterim('Understanding…');

        if (!blob.size) {
          setInterim('');
          return '';
        }

        const audio = await blobToBase64(blob);
        const response = await fetch('/api/speech/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio, language: lang, mimeType: blob.type }),
        });
        const data = await response.json().catch(() => ({}));
        setInterim('');

        if (response.ok && data?.success && typeof data.transcript === 'string') {
          const transcript = data.transcript.trim();
          if (transcript) {
            setMicError('');
            return transcript;
          }
          return '';
        }

        return '';
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (vadFrameRef.current !== null) {
          cancelAnimationFrame(vadFrameRef.current);
          vadFrameRef.current = null;
        }
        setListening(false);
        setInterim('');
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setMicError('not-allowed');
          return '';
        }
        return null;
      } finally {
        if (hardStopTimer) clearTimeout(hardStopTimer);
      }
    },
    [lang]
  );

  const listen = useCallback(
    async (timeoutMs = 9000): Promise<string> => {
      const cloudResult = await cloudListen(timeoutMs);
      if (cloudResult !== null) return cloudResult;
      return browserListen(Math.min(timeoutMs, 9000));
    },
    [browserListen, cloudListen]
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
      if (vadFrameRef.current !== null) {
        cancelAnimationFrame(vadFrameRef.current);
        vadFrameRef.current = null;
      }
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      // Explicit Stop ends the assistant session, so releasing the context is safe.
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    } catch {
      /* ignore */
    }
  }, []);

  const askAndListen = useCallback(
    async (prompt: string, timeoutMs = 9000): Promise<string> => {
      await speak(prompt);
      await new Promise((r) => setTimeout(r, 120));
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
