"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useAudio() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("pi-sound-enabled");
    return stored === null ? true : stored === "true";
  });

  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const existing = audioContextRef.current;
    if (existing) {
      if (existing.state === "suspended") {
        try {
          await existing.resume();
        } catch {
          // ignore resume errors
        }
      }
      return existing;
    }
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("pi-sound-enabled", String(next));
      if (next) void getAudioContext();
      return next;
    });
  }, [getAudioContext]);

  const playDone = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = now + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } catch {
      // AudioContext not available
    }
  }, [getAudioContext]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  return { soundEnabled: enabled, onSoundToggle: toggle, playDoneSound: playDone, soundEnabledRef: enabledRef };
}
