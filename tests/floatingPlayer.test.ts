import type { ButtonHTMLAttributes, PointerEvent, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultPlayer } from '../src/core/model';
import type { AudioController } from '../src/core/useAudio';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) => [value, vi.fn()],
  useEffect: vi.fn(),
}));
import { FloatingPlayer } from '../src/components/FloatingPlayer';
afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal('innerWidth', 800);
  vi.stubGlobal('innerHeight', 600);
  const onPosition = vi.fn();
  const element = FloatingPlayer({
    tracks: [],
    selected: null,
    select: vi.fn(),
    audio: { state: { playing: false } } as AudioController,
    position: { ...defaultPlayer, x: 100, y: 100, collapsed: true },
    onPosition,
    pinned: false,
    onPin: vi.fn(),
    onActivate: vi.fn(),
    order: 1,
    sourcePage: 1,
    onClose: vi.fn(),
  }) as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  const pointer = (x: number, y: number, id = 1) =>
    ({
      isPrimary: true,
      button: 0,
      pointerId: id,
      clientX: x,
      clientY: y,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    }) as unknown as PointerEvent<HTMLButtonElement>;
  return { button: element.props, onPosition, pointer };
}

describe('floating player touch drag', () => {
  it('commits the release coordinates without waiting for a React render and does not expand after drag', () => {
    const { button, onPosition, pointer } = setup();
    button.onPointerDown!(pointer(100, 100));
    button.onPointerUp!(pointer(160, 180));
    expect(onPosition).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 12, y: 180, width: 392, height: 280, collapsed: true }),
      true,
    );
    const count = onPosition.mock.calls.length;
    button.onClick!({} as never);
    expect(onPosition).toHaveBeenCalledTimes(count);
  });
  it('keeps preferred expanded dimensions after a stationary handle tap', () => {
    const { button, onPosition, pointer } = setup();
    button.onPointerDown!(pointer(100, 100));
    button.onPointerUp!(pointer(100, 100));
    button.onClick!({} as never);
    expect(onPosition).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 392, height: 280, collapsed: false }),
      true,
    );
  });
  it('ends a cancelled drag and prevents a delayed compatibility click from expanding it', () => {
    const { button, onPosition, pointer } = setup();
    button.onPointerDown!(pointer(100, 100));
    button.onPointerMove!(pointer(120, 140));
    button.onPointerCancel!(pointer(120, 140));
    const count = onPosition.mock.calls.length;
    button.onPointerMove!(pointer(400, 400));
    button.onClick!({} as never);
    expect(onPosition).toHaveBeenCalledTimes(count);
  });
  it('does not let a second primary pen or touch replace the active drag', () => {
    const { button, onPosition, pointer } = setup();
    button.onPointerDown!(pointer(100, 100));
    button.onPointerDown!(pointer(300, 300, 2));
    button.onPointerUp!(pointer(300, 300, 2));
    expect(onPosition).not.toHaveBeenCalled();
    button.onLostPointerCapture!(pointer(100, 100));
    expect(onPosition).toHaveBeenCalledOnce();
  });
});
