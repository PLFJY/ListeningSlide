import { useCallback, useEffect, useRef, useState } from 'react';
import { audioBounds, clamp, relativeToAbsolute, type AudioBounds } from './audio';
import type { AudioTrack } from './model';
export interface AudioStatus {
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  rate: number;
  a: number | null;
  b: number | null;
  error: string;
}
const initial: AudioStatus = {
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  rate: 1,
  a: null,
  b: null,
  error: '',
};
export function useAudio(track: AudioTrack | null, endBehavior: 'hold' | 'restart') {
  const [state, setState] = useState<AudioStatus>(initial);
  const audio = useRef<HTMLAudioElement | null>(null),
    bounds = useRef<AudioBounds | null>(null),
    loop = useRef<{ a: number | null; b: number | null }>({ a: null, b: null }),
    status = useRef(state),
    behavior = useRef(endBehavior);
  status.current = state;
  behavior.current = endBehavior;
  useEffect(() => {
    setState((s) => ({
      ...initial,
      rate: s.rate,
      loading: !!track && !track.trimError,
      error: track?.trimError || '',
    }));
    loop.current = { a: null, b: null };
    bounds.current = null;
    if (!track || track.trimError) {
      audio.current = null;
      return;
    }
    const el = new Audio();
    audio.current = el;
    el.preload = 'metadata';
    el.playbackRate = status.current.rate;
    let alive = true,
      raf = 0;
    const patch = (p: Partial<AudioStatus>) => {
      if (alive) setState((s) => ({ ...s, ...p }));
    };
    const fail = (message: string) => {
      el.pause();
      patch({ loading: false, playing: false, error: message });
    };
    const timer = setTimeout(() => {
      if (!bounds.current) fail('音频元数据读取超时，无法确认裁剪范围。');
    }, 15000);
    const metadata = () => {
      try {
        const range = audioBounds(el.duration, track.trimStart, track.trimEnd);
        bounds.current = range;
        el.currentTime = range.start;
        clearTimeout(timer);
        patch({
          loading: false,
          duration: range.duration,
          error: '',
        });
      } catch (e) {
        fail((e as Error).message);
      }
    };
    const check = () => {
      const range = bounds.current;
      if (!range) return;
      const a = loop.current.a,
        b = loop.current.b;
      if (a !== null && b !== null && el.currentTime >= range.start + b - 0.015) {
        el.currentTime = range.start + a;
      } else if (el.currentTime >= range.end - 0.015) {
        el.pause();
        el.currentTime = behavior.current === 'restart' ? range.start : range.end;
      } else if (el.currentTime < range.start) el.currentTime = range.start;
      patch({
        position: clamp(el.currentTime - range.start, 0, range.duration),
        playing: !el.paused,
      });
    };
    const tick = () => {
      check();
      if (!el.paused && alive) raf = requestAnimationFrame(tick);
    };
    el.addEventListener('loadedmetadata', metadata);
    el.addEventListener('durationchange', () => {
      if (Number.isFinite(el.duration) && !bounds.current) metadata();
    });
    el.addEventListener('timeupdate', check);
    el.addEventListener('seeking', () => {
      const r = bounds.current;
      if (r && (el.currentTime < r.start || el.currentTime > r.end))
        el.currentTime = clamp(el.currentTime, r.start, r.end);
    });
    el.addEventListener('play', () => {
      patch({ playing: true });
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    });
    el.addEventListener('pause', () => patch({ playing: false }));
    el.addEventListener('ended', check);
    el.addEventListener('error', () =>
      fail('无法解码此音频，请检查资源是否完整以及编码是否受支持。'),
    );
    el.src = track.src;
    el.load();
    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      el.pause();
      el.removeAttribute('src');
      el.load();
      audio.current = null;
      bounds.current = null;
    };
  }, [track?.id, track?.src]);
  const seek = useCallback((position: number) => {
    const r = bounds.current,
      el = audio.current;
    if (r && el) {
      el.currentTime = relativeToAbsolute(position, r);
      setState((s) => ({ ...s, position: clamp(position, 0, r.duration) }));
    }
  }, []);
  const play = useCallback(async () => {
    const el = audio.current,
      r = bounds.current;
    if (!el || !r) return;
    if (el.currentTime >= r.end - 0.03) el.currentTime = r.start;
    try {
      await el.play();
    } catch (error) {
      // A deliberate pause, seek or track switch can abort an in-flight play() request.
      if (audio.current !== el || (error instanceof DOMException && error.name === 'AbortError'))
        return;
      setState((s) => ({
        ...s,
        error: '播放失败，请重新点击播放或检查音频编码。',
        playing: false,
      }));
    }
  }, []);
  const toggle = useCallback(() => {
    if (audio.current?.paused) void play();
    else audio.current?.pause();
  }, [play]);
  const rate = useCallback((value: number) => {
    if (audio.current) audio.current.playbackRate = value;
    setState((s) => ({ ...s, rate: value }));
  }, []);
  const setAB = useCallback(() => {
    const s = status.current;
    let next: { a: number | null; b: number | null };
    if (s.a === null) next = { a: s.position, b: null };
    else if (s.b === null) {
      if (s.position - s.a < 0.25) return;
      next = { a: s.a, b: s.position };
    } else next = { a: null, b: null };
    loop.current = next;
    setState((s) => ({ ...s, ...next }));
  }, []);
  const clearAB = useCallback(() => {
    loop.current = { a: null, b: null };
    setState((s) => ({ ...s, a: null, b: null }));
  }, []);
  return {
    state,
    seek,
    toggle,
    rate,
    setAB,
    clearAB,
    rewind: (seconds: number) => seek(status.current.position - seconds),
    restart: () => seek(0),
  };
}
export type AudioController = ReturnType<typeof useAudio>;
