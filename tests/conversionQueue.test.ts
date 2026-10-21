import { describe, expect, it, vi } from 'vitest';
import { createConversionQueue } from '../electron/conversionQueue';
import type { ConvertedPresentation } from '../src/slideshow/types';
const payload = (value: number): ConvertedPresentation => ({
  binary: new Uint8Array([value]),
  media: [],
});
describe('overlapping file opens', () => {
  it('shares one in-flight conversion for the same file contents', async () => {
    const convert = vi.fn(async () => payload(1));
    const enqueue = createConversionQueue(convert);
    const first = enqueue(new Uint8Array([1]));
    const second = enqueue(new Uint8Array([1]));
    expect(await Promise.all([first, second])).toEqual([payload(1), payload(1)]);
    expect(convert).toHaveBeenCalledTimes(1);
  });
  it('lets a different file wait and preserves each caller’s result', async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: number[] = [];
    const enqueue = createConversionQueue(async (bytes) => {
      order.push(bytes[0]);
      if (bytes[0] === 1) await waiting;
      return payload(bytes[0]);
    });
    const first = enqueue(new Uint8Array([1]));
    const second = enqueue(new Uint8Array([2]));
    await Promise.resolve();
    expect(order).toEqual([1]);
    release();
    expect(await Promise.all([first, second])).toEqual([payload(1), payload(2)]);
    expect(order).toEqual([1, 2]);
  });
  it('does not leave conversion locked after a failed job', async () => {
    const enqueue = createConversionQueue(async (bytes) => {
      if (bytes[0] === 1) throw new Error('bad file');
      return payload(2);
    });
    const first = enqueue(new Uint8Array([1]));
    const second = enqueue(new Uint8Array([2]));
    await expect(first).rejects.toThrow('bad file');
    await expect(second).resolves.toEqual(payload(2));
  });
});
