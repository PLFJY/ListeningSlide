import { createHash } from 'node:crypto';
import type { ConvertedPresentation } from '../src/slideshow/types';

/** Share duplicate opens and serialize x2t jobs instead of rejecting a user's newer open. */
export function createConversionQueue(
  convert: (input: Uint8Array) => Promise<ConvertedPresentation>,
) {
  let tail = Promise.resolve();
  const pending = new Map<string, Promise<ConvertedPresentation>>();
  return (input: Uint8Array): Promise<ConvertedPresentation> => {
    if (!(input instanceof Uint8Array)) return Promise.reject(new Error('请选择有效的 PPTX。'));
    const key = createHash('sha256').update(input).digest('hex');
    const existing = pending.get(key);
    if (existing) return existing;
    const job = tail.then(() => convert(input));
    pending.set(key, job);
    tail = job.then(
      () => undefined,
      () => undefined,
    );
    void job.then(
      () => pending.delete(key),
      () => pending.delete(key),
    );
    return job;
  };
}
