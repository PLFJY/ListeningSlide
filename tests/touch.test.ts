import { describe, expect, it } from 'vitest';
import { PointerClicks, TouchSession, pointerSamples } from '../src/core/touch';
import { playerSize, placePlayer } from '../src/core/playerLayout';
import { defaultPlayer } from '../src/core/model';
import { pointNearAudioArea } from '../src/core/audioObjects';

describe('touch contact lifecycle', () => {
  it('blocks a multi-finger gesture until all fingers lift, including a replacement finger', () => {
    const contacts = new TouchSession();
    expect(contacts.begin(1)).toBe(true);
    expect(contacts.begin(2)).toBe(false);
    expect(contacts.release(1)).toBe(false);
    expect(contacts.begin(3)).toBe(false);
    expect(contacts.release(2)).toBe(false);
    expect(contacts.release(3)).toBe(false);
    expect(contacts.begin(4)).toBe(true);
    expect(contacts.release(4)).toBe(true);
  });
  it('can cancel contacts on blur or resize without accepting their late releases', () => {
    const contacts = new TouchSession();
    contacts.begin(10);
    expect(contacts.reset()).toEqual([10]);
    expect(contacts.release(10)).toBe(false);
    expect(contacts.begin(11)).toBe(true);
  });
});

describe('pointer compatibility clicks', () => {
  it('blocks both palm and pen clicks but preserves independent keyboard activation', () => {
    const clicks = new PointerClicks();
    clicks.begin(1);
    clicks.begin(2);
    clicks.block(1);
    clicks.block(2);
    expect(clicks.consume({ detail: 0 })).toBe(false);
    expect(clicks.consume({ pointerId: 2, detail: 0 })).toBe(true);
    expect(clicks.consume({ pointerId: 1, detail: 1 })).toBe(true);
    expect(clicks.consume({ pointerId: 3, detail: 1 })).toBe(false);
  });
  it('does not swallow a real next tap after a cancelled stroke with no click', () => {
    const clicks = new PointerClicks();
    clicks.block(1);
    clicks.begin(1);
    expect(clicks.consume({ pointerId: 1, detail: 1 })).toBe(false);
    clicks.block(2);
    expect(clicks.consume({ detail: 0, pointerId: -1 })).toBe(false);
    clicks.begin(3);
    expect(clicks.consume({ detail: 1 })).toBe(false);
  });
  it('provides a bounded fallback for legacy mouse compatibility events', () => {
    const clicks = new PointerClicks();
    clicks.block(1);
    expect(clicks.consume({ detail: 1 })).toBe(true);
    expect(clicks.consume({ detail: 1 })).toBe(false);
  });
});

it('preserves the last stylus samples and always includes the dispatched endpoint', () => {
  const event = {
    clientX: 100,
    clientY: 50,
    getCoalescedEvents: () => Array.from({ length: 100 }, (_, x) => ({ clientX: x, clientY: 50 })),
  };
  const samples = pointerSamples(event);
  expect(samples).toHaveLength(64);
  expect(samples.at(-1)).toBe(event);
  expect(samples[0].clientX).toBe(37);
  expect(pointerSamples({ clientX: 1, clientY: 2 })).toEqual([{ clientX: 1, clientY: 2 }]);
});

describe('player bounds across screen and fullscreen changes', () => {
  it('keeps the entire controller reachable on a smaller viewport', () => {
    const saved = { ...defaultPlayer, x: 1200, y: 800, width: 900, height: 350 };
    const placed = placePlayer(saved, [], { w: 640, h: 300 });
    expect(placed.width).toBe(624);
    expect(placed.height).toBe(284);
    expect(placed.x + placed.width).toBeLessThanOrEqual(640);
    expect(placed.y + placed.height).toBeLessThanOrEqual(300);
  });
  it('reserves room for touch controls and keeps collapsed sizes separate', () => {
    const saved = { ...defaultPlayer, height: 110 };
    expect(playerSize(saved, { w: 800, h: 600 }).height).toBe(208);
    expect(playerSize(saved, { w: 800, h: 600 }, true)).toEqual({ width: 56, height: 56 });
    expect(saved.width).toBe(defaultPlayer.width);
  });
});

describe('small audio targets on touchscreens', () => {
  const area = [
    { x: 10, y: 10 },
    { x: 30, y: 10 },
    { x: 30, y: 30 },
    { x: 10, y: 30 },
  ];
  it('accepts nearby fingers within the expanded target without accepting distant taps', () => {
    expect(pointNearAudioArea({ x: 5, y: 20 }, area, 12)).toBe(true);
    expect(pointNearAudioArea({ x: -5, y: 20 }, area, 12)).toBe(false);
    expect(pointNearAudioArea({ x: 5, y: 20 }, area, 0)).toBe(false);
  });
  it('does not create a target for missing or degenerate geometry', () => {
    expect(pointNearAudioArea({ x: 0, y: 0 }, [], 12)).toBe(false);
    expect(
      pointNearAudioArea(
        { x: 0, y: 0 },
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        12,
      ),
    ).toBe(false);
  });
});
