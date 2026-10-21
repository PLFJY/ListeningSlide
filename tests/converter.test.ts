import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import os from 'node:os';
import { convertPresentation } from '../electron/onlyoffice';
describe('native converter input boundary', () => {
  it('rejects non-PPTX data before attempting native execution', async () => {
    await expect(
      convertPresentation(new Uint8Array([1, 2, 3, 4]), '/missing-runtime', os.tmpdir()),
    ).rejects.toThrow('有效 PPTX');
    const zip = new JSZip();
    zip.file('readme.txt', 'not a presentation');
    await expect(
      convertPresentation(
        await zip.generateAsync({ type: 'uint8array' }),
        '/missing-runtime',
        os.tmpdir(),
      ),
    ).rejects.toThrow('PowerPoint');
  });
  it('rejects archive traversal using the original unsanitized entry name', async () => {
    const zip = new JSZip();
    zip.file('ppt/presentation.xml', '<p:presentation/>');
    zip.file('../outside.txt', 'blocked');
    await expect(
      convertPresentation(
        await zip.generateAsync({ type: 'uint8array' }),
        '/missing-runtime',
        os.tmpdir(),
      ),
    ).rejects.toThrow('不安全');
  });
});
