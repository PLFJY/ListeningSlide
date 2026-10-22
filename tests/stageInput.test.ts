import { describe, expect, it } from 'vitest';
import { StageInput } from '../src/core/stageInput';
import { classifyGesture } from '../src/core/gestures';

describe('slideshow input isolation', () => {
  it('discards a swipe started before ink was enabled, even after returning to browsing', () => {
    const input = new StageInput();
    const swipe = input.navigation();
    expect(classifyGesture({ x: 500, y: 100 }, { x: 100, y: 100 }, 200)).toBe('next');
    input.setAnnotation(true);
    expect(input.allows(swipe)).toBe(false);
    input.setAnnotation(false);
    expect(input.allows(swipe)).toBe(false);
    expect(input.allows(input.navigation())).toBe(true);
  });

  it('blocks writing, wheel and board keyboard navigation but accepts explicit page controls', () => {
    const input = new StageInput();
    input.setAnnotation(true);
    expect(input.isAnnotating()).toBe(true);
    expect(input.navigation()).toBeNull();
    const button = input.navigation(true);
    expect(input.allows(button)).toBe(true);
    // Opening/closing the palette or selecting a different ink tool keeps writing active.
    input.setAnnotation(true);
    expect(input.allows(button)).toBe(true);
    expect(input.navigation()).toBeNull();
  });

  it('rejects queued engine work and late page-advance replies after a mode change', async () => {
    const input = new StageInput();
    const request = input.navigation();
    const deferred = Promise.resolve().then(() => input.allows(request));
    input.setAnnotation(true);
    expect(await deferred).toBe(false);
    const reply = structuredClone(request);
    expect(input.allows(reply)).toBe(false);
    expect(input.allows(undefined)).toBe(false);
  });

  it('invalidates old replies after jumping or resetting a slide', () => {
    const input = new StageInput();
    const request = input.navigation(true);
    input.invalidate();
    expect(input.allows(request)).toBe(false);
    expect(input.allows(input.navigation(true))).toBe(true);
  });
});
