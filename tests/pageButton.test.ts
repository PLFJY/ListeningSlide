import type { ButtonHTMLAttributes, MouseEvent, PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Exercise pointer handlers without a DOM, browser, or Electron window.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useRef: <T>(value: T) => ({ current: value }),
}));
import { PageButton } from '../src/components/PageButton';

function setup() {
  const onClick = vi.fn();
  const button = PageButton({ onClick }).props as ButtonHTMLAttributes<HTMLButtonElement>;
  const pointer = (x: number, y: number) =>
    ({
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      isPrimary: true,
      currentTarget: { setPointerCapture: vi.fn() },
    }) as unknown as PointerEvent<HTMLButtonElement>;
  const click = (detail = 1) =>
    button.onClick!({
      detail,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent<HTMLButtonElement>);
  return { button, pointer, click, onClick };
}

describe('touchscreen page buttons', () => {
  it('accepts a slow stationary touch without treating it as a swipe', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2000);
    try {
      const { button, pointer, click, onClick } = setup();
      button.onPointerDown!(pointer(0, 0));
      button.onPointerUp!(pointer(1, 1));
      click();
      expect(onClick).toHaveBeenCalledOnce();
    } finally {
      clock.mockRestore();
    }
  });
  it('discards a lost capture and permits an explicit keyboard press afterwards', () => {
    const { button, pointer, click, onClick } = setup();
    button.onPointerDown!(pointer(0, 0));
    button.onLostPointerCapture!(pointer(10, 10));
    button.onPointerUp!(pointer(1, 1));
    click(0);
    expect(onClick).not.toHaveBeenCalled();
    button.onKeyDown!({ key: 'Enter' } as never);
    click(0);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('accepts a tap and rejects a swipe over the button', () => {
    const { button, pointer, click, onClick } = setup();
    button.onPointerDown!(pointer(0, 0));
    button.onPointerUp!(pointer(2, 1));
    click();
    expect(onClick).toHaveBeenCalledOnce();
    button.onPointerDown!(pointer(0, 0));
    button.onPointerMove!(pointer(100, 0));
    button.onPointerUp!(pointer(120, 0));
    click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('rejects an out-and-back stroke, including a board click with detail zero', () => {
    const { button, pointer, click, onClick } = setup();
    button.onPointerDown!(pointer(0, 0));
    button.onPointerMove!(pointer(100, 0));
    button.onPointerUp!(pointer(1, 0));
    click(0);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('rejects a cancelled touch and still accepts keyboard activation', () => {
    const { button, pointer, click, onClick } = setup();
    button.onPointerDown!(pointer(0, 0));
    button.onPointerCancel!(pointer(1, 0));
    click();
    expect(onClick).not.toHaveBeenCalled();
    click(0);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
