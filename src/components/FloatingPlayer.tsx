import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Maximize2,
  Pause,
  Pin,
  PinOff,
  Play,
  Repeat2,
  RotateCcw,
  SkipBack,
  X,
} from 'lucide-react';
import type { AudioTrack, PlayerSettings } from '../core/model';
import type { AudioController } from '../core/useAudio';
import { clampPlayer } from '../core/gestures';
import { clamp, timeLabel } from '../core/audio';
interface Props {
  tracks: AudioTrack[];
  selected: string | null;
  select: (id: string) => void;
  audio: AudioController;
  position: PlayerSettings;
  onPosition: (position: PlayerSettings, persist?: boolean) => void;
  pinned: boolean;
  onPin: () => void;
  onActivate: () => void;
  order: number;
  sourcePage: number;
  onClose: () => void;
}
export function FloatingPlayer({
  tracks,
  selected,
  select,
  audio,
  position,
  onPosition,
  pinned,
  onPin,
  onActivate,
  order,
  sourcePage,
  onClose,
}: Props) {
  const [viewport, setViewport] = useState({ w: innerWidth, h: innerHeight });
  const setPosition = (next: PlayerSettings) => onPosition(next);
  const ref = useRef(position);
  ref.current = position;
  const gesture = useRef<{
    type: 'drag' | 'resize';
    id: number;
    x: number;
    y: number;
    base: PlayerSettings;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const { state } = audio;
  const track = tracks.find((t) => t.id === selected);
  const collapsed = position.collapsed;
  const width = collapsed ? 56 : Math.min(position.width, viewport.w - 16),
    height = collapsed ? 56 : position.height;
  const constrained = clampPlayer(
    position.x < 0 ? viewport.w - width - 28 : position.x,
    position.y < 0 ? viewport.h - height - 28 : position.y,
    width,
    height,
    viewport.w,
    viewport.h,
  );
  useEffect(() => {
    const resize = () => setViewport({ w: innerWidth, h: innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const persist = (next: PlayerSettings) => {
    onPosition(next, true);
  };
  function start(event: PointerEvent<HTMLElement>, type: 'drag' | 'resize') {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      type,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      base: { ...position, ...constrained },
      moved: false,
    };
    suppressClick.current = false;
  }
  function move(event: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x,
      dy = event.clientY - g.y;
    if (Math.hypot(dx, dy) > 4) g.moved = true;
    if (g.type === 'drag')
      setPosition({
        ...g.base,
        ...clampPlayer(g.base.x + dx, g.base.y + dy, width, height, viewport.w, viewport.h),
      });
    else {
      const w = clamp(
        g.base.width + dx,
        Math.min(280, viewport.w - 16),
        Math.max(280, viewport.w * 0.8),
      );
      const h = clamp(g.base.height + dy, 110, Math.min(280, viewport.h));
      setPosition({
        ...g.base,
        width: w,
        height: h,
        ...clampPlayer(g.base.x, g.base.y, w, h, viewport.w, viewport.h),
      });
    }
  }
  function end(event: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    suppressClick.current = g.moved;
    let next = ref.current;
    if (g.type === 'drag' && collapsed) {
      const x = next.x < viewport.w / 2 ? 12 : viewport.w - 68;
      next = { ...next, x };
    }
    persist(next);
  }
  const common = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  if (collapsed)
    return (
      <button
        data-overlay
        data-player
        data-audio-id={selected}
        data-pinned={pinned}
        className={`player-handle ${state.playing ? 'is-playing' : ''}`}
        style={{
          left: constrained.x,
          top: constrained.y,
          opacity: position.opacity,
          zIndex: order,
        }}
        aria-label="展开音频播放器"
        title={`第 ${sourcePage} 页 · ${track?.name}${pinned ? ' · 已固定' : ''}`}
        onPointerDownCapture={onActivate}
        onFocusCapture={onActivate}
        onPointerDown={(e) => start(e, 'drag')}
        {...common}
        onClick={() => {
          if (!suppressClick.current) persist({ ...position, collapsed: false });
        }}
      >
        <AudioLines size={24} />
        {pinned && <Pin className="pinned-badge" size={12} />}
        {state.playing && <span className="playing-dot" />}
      </button>
    );
  return (
    <section
      data-overlay
      data-player
      data-audio-id={selected}
      data-pinned={pinned}
      className={`floating-player ${height < 190 ? 'compact-player' : ''} ${width < 340 ? 'narrow-player' : ''}`}
      style={{
        left: constrained.x,
        top: constrained.y,
        width,
        height,
        zIndex: order,
        background: `rgba(18,28,38,${position.opacity})`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      aria-label={`音频播放器：${track?.name}`}
    >
      <header className="player-header">
        <div
          role="button"
          tabIndex={0}
          aria-label="拖动播放器"
          className="player-drag"
          title={`第 ${sourcePage} 页 · ${track?.name}`}
          onPointerDown={(e) => start(e, 'drag')}
          {...common}
        >
          <GripHorizontal size={16} />
          <span>
            {sourcePage} · {track?.name}
          </span>
        </div>
        <button
          className={pinned ? 'pin-active' : ''}
          aria-label={pinned ? '取消固定音频' : '固定音频'}
          aria-pressed={pinned}
          title={pinned ? '取消固定音频' : '固定音频，跨页保留'}
          onClick={onPin}
        >
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button aria-label="折叠播放器" onClick={() => persist({ ...position, collapsed: true })}>
          <ChevronDown size={18} />
        </button>
        <button aria-label="关闭播放器" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="player-body">
        {tracks.length > 1 && height >= 190 && (
          <select
            className="track-select"
            aria-label="打开同页音频"
            value={selected || ''}
            onChange={(e) => select(e.target.value)}
          >
            {tracks.map((t, i) => (
              <option value={t.id} key={t.id}>
                {i + 1}. {t.name}
              </option>
            ))}
          </select>
        )}
        <div className="timeline">
          <span>{timeLabel(state.position)}</span>
          <div className="range-wrap">
            <input
              aria-label="音频进度"
              type="range"
              min="0"
              max={state.duration || 1}
              step="0.05"
              value={state.position}
              disabled={!state.duration}
              onChange={(e) => audio.seek(+e.target.value)}
              style={
                {
                  '--progress': `${state.duration ? (state.position / state.duration) * 100 : 0}%`,
                } as React.CSSProperties
              }
            />
            {state.a !== null && (
              <div className="ab-marker" style={{ left: `${(state.a / state.duration) * 100}%` }}>
                A
              </div>
            )}
            {state.b !== null && (
              <div className="ab-marker" style={{ left: `${(state.b / state.duration) * 100}%` }}>
                B
              </div>
            )}
          </div>
          <span>{timeLabel(state.duration)}</span>
        </div>
        <div className="transport">
          <button
            title="从裁剪起点重播"
            aria-label="从头重播"
            disabled={!state.duration}
            onClick={audio.restart}
          >
            <SkipBack size={19} />
          </button>
          <button
            className="rewind"
            aria-label="回退10秒"
            disabled={!state.duration}
            onClick={() => audio.rewind(10)}
          >
            <RotateCcw size={24} />
            <small>10</small>
          </button>
          <button
            className="play-button"
            aria-label={state.playing ? '暂停' : '播放'}
            disabled={!state.duration || !!state.error}
            onClick={audio.toggle}
          >
            {state.playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>
          <button
            className="rewind"
            aria-label="回退5秒"
            disabled={!state.duration}
            onClick={() => audio.rewind(5)}
          >
            <RotateCcw size={24} />
            <small>5</small>
          </button>
          <select
            aria-label="播放速度"
            className="rate-select"
            value={state.rate}
            onChange={(e) => audio.rate(+e.target.value)}
          >
            {[0.75, 0.85, 1, 1.15, 1.25].map((n) => (
              <option key={n} value={n}>
                {n.toFixed(n === 1 ? 1 : 2)}×
              </option>
            ))}
          </select>
        </div>
        <div className="player-secondary">
          <button
            className={state.b !== null ? 'loop-active' : ''}
            disabled={!state.duration}
            aria-label={state.a === null ? '设置A点' : state.b === null ? '设置B点' : '取消AB循环'}
            onClick={audio.setAB}
          >
            <Repeat2 size={16} />
            {state.a === null
              ? 'A–B 循环'
              : state.b === null
                ? '设置 B 点'
                : `${timeLabel(state.a)} – ${timeLabel(state.b)}`}
          </button>
          {state.a !== null && (
            <button aria-label="清除循环" onClick={audio.clearAB}>
              <X size={15} />
            </button>
          )}
          <button
            disabled={!state.duration}
            aria-label="前进5秒"
            onClick={() => audio.seek(state.position + 5)}
          >
            +5s
          </button>
          <button
            disabled={!state.duration}
            aria-label="前进10秒"
            onClick={() => audio.seek(state.position + 10)}
          >
            +10s
          </button>
          <span>
            {state.loading
              ? '读取音频…'
              : track && (track.trimStart || track.trimEnd)
                ? '已应用 PPT 裁剪'
                : track
                  ? '原始音轨'
                  : '本页无音频'}
          </span>
        </div>
      </div>
      {state.error && (
        <div className="audio-error" role="alert">
          {state.error}
        </div>
      )}
      <button
        className="resize-handle"
        aria-label="调整播放器大小"
        onPointerDown={(e) => start(e, 'resize')}
        {...common}
      >
        <Maximize2 size={13} />
      </button>
      {height < 190 && (
        <button
          className="expand-details"
          aria-label="展开循环控制"
          onClick={() => persist({ ...position, height: 224 })}
        >
          <ChevronUp size={13} />
        </button>
      )}
    </section>
  );
}
