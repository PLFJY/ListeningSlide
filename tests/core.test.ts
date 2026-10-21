import { describe, it, expect } from 'vitest';
import { audioBounds, relativeToAbsolute } from '../src/core/audio';
import { classifyGesture, clampPlayer } from '../src/core/gestures';
import { xml, parseTime, all, resolvePart } from '../src/importer/xml';
describe('PowerPoint media boundaries', () => {
  it('treats end as duration removed from the end', () => {
    expect(audioBounds(180, 30, 40)).toEqual({ start: 30, end: 140, duration: 110 });
  });
  it('keeps seeks and rewinds inside the trimmed timeline', () => {
    const b = audioBounds(180, 30, 40);
    expect(relativeToAbsolute(-10, b)).toBe(30);
    expect(relativeToAbsolute(999, b)).toBe(140);
    expect(relativeToAbsolute(5, b)).toBe(35);
  });
  it('rejects unknown metadata and invalid trim instead of playing untrimmed audio', () => {
    expect(() => audioBounds(Infinity, 0, 1)).toThrow();
    expect(() => audioBounds(10, 3, 8)).toThrow();
    expect(() => audioBounds(10, -1, 0)).toThrow();
  });
  it.each([
    ['30000', 30],
    ['30s', 30],
    ['1.5s', 1.5],
    ['200ms', 0.2],
    ['2min', 120],
    ['00:01:05.5', 65.5],
  ])('reads time %s', (s, n) => expect(parseTime(s as string)).toBe(n));
  it('rejects malformed time', () => expect(() => parseTime('tomorrow')).toThrow());
});
describe('swipe navigation', () => {
  it('swipes left to next and right to previous', () => {
    expect(classifyGesture({ x: 500, y: 200 }, { x: 350, y: 210 }, 300)).toBe('next');
    expect(classifyGesture({ x: 350, y: 210 }, { x: 500, y: 200 }, 300)).toBe('previous');
  });
  it('ignores vertical movements, ambiguous diagonals, long holds and jitter', () => {
    expect(classifyGesture({ x: 0, y: 0 }, { x: 70, y: 80 }, 200)).toBe('none');
    expect(classifyGesture({ x: 0, y: 0 }, { x: -200, y: 0 }, 2000)).toBe('none');
    expect(classifyGesture({ x: 0, y: 0 }, { x: 20, y: 0 }, 200)).toBe('none');
  });
  it('does not turn an out-and-back gesture into a tap', () =>
    expect(classifyGesture({ x: 0, y: 0 }, { x: 1, y: 1 }, 200, 100)).toBe('none'));
  it('keeps the controller accessible even when the viewport shrinks', () =>
    expect(clampPlayer(1500, 900, 392, 224, 800, 600)).toEqual({ x: 408, y: 376 }));
});
describe('OOXML helpers', () => {
  it('resolves relationship parts without assuming media directory order', () =>
    expect(resolvePart('ppt/slides/slide8.xml', '../media/audio3.mp3')).toBe(
      'ppt/media/audio3.mp3',
    ));
  it('rejects XML entities', () =>
    expect(() => xml('<!DOCTYPE x [<!ENTITY xx SYSTEM "file:///tmp/x">]><x/>')).toThrow());
});
describe('relationship media extraction', () => {
  it('restores two independently trimmed objects pointing to a single source', async () => {
    const [{ default: JSZip }, { readFile }, { extractAudio }] = await Promise.all([
      import('jszip'),
      import('node:fs/promises'),
      import('../src/importer/pptx'),
    ]);
    const zip = await JSZip.loadAsync(await readFile('public/demo.pptx'));
    const part = 'ppt/slides/slide2.xml';
    const root = xml(await zip.file(part)!.async('string'));
    const urls: string[] = [],
      warnings: string[] = [];
    try {
      const tracks = await extractAudio(zip, part, root, urls, warnings);
      expect(tracks).toHaveLength(2);
      expect(tracks[0].src).toBe(tracks[1].src);
      expect(tracks[0]).toMatchObject({ trimStart: 1, trimEnd: 2 });
      expect(tracks[1]).toMatchObject({ trimStart: 3, trimEnd: 4 });
      expect(tracks[0].id).not.toBe(tracks[1].id);
      expect(warnings).toEqual([]);
    } finally {
      urls.forEach(URL.revokeObjectURL);
    }
  });
  it('preserves namespaced relationship IDs distinct from numeric slide IDs', () => {
    const root = xml(
      '<p:sldIdLst xmlns:p="urn:p" xmlns:r="urn:r"><p:sldId r:id="rId5" id="256"/></p:sldIdLst>',
    );
    expect(all(root, 'sldId')[0].attrs).toMatchObject({ 'r:id': 'rId5', id: '256' });
  });
});
describe('audio source variants and hit testing', () => {
  it('prefers embedded media over an unavailable external legacy audio link', async () => {
    const [{ default: JSZip }, { extractAudio }] = await Promise.all([
      import('jszip'),
      import('../src/importer/pptx'),
    ]);
    const zip = new JSZip();
    const part = 'ppt/slides/slide1.xml';
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      '<Relationships><Relationship Id="legacy" Type="urn:rels/audio" Target="https://example.invalid/missing.wav" TargetMode="External"/><Relationship Id="embedded" Type="urn:rels/media" Target="../media/source.wav"/></Relationships>',
    );
    zip.file('ppt/media/source.wav', new Uint8Array([1, 2, 3]));
    const root = xml(
      '<p:sld xmlns:p="urn:p" xmlns:a="urn:a" xmlns:r="urn:r" xmlns:p14="urn:p14"><p:pic><p:nvPicPr><p:cNvPr id="8" name="Sound"/><p:nvPr><a:audioFile r:link="legacy"/><p14:media r:embed="embedded"><p14:trim st="1s" end="2s"/></p14:media></p:nvPr></p:nvPicPr><p:spPr><a:xfrm><a:off x="952500" y="1905000"/><a:ext cx="381000" cy="190500"/></a:xfrm></p:spPr></p:pic></p:sld>',
    );
    const urls: string[] = [],
      warnings: string[] = [];
    try {
      const tracks = await extractAudio(zip, part, root, urls, warnings);
      expect(tracks).toHaveLength(1);
      expect(tracks[0]).toMatchObject({
        shapeId: '8',
        trimStart: 1,
        trimEnd: 2,
      });
      expect(warnings).toEqual([]);
    } finally {
      urls.forEach(URL.revokeObjectURL);
    }
  });
  it.each([
    '<a:wavAudioFile r:embed="sound"/>',
    '<a:hlinkClick><a:snd r:embed="sound"/></a:hlinkClick>',
  ])('recognizes sound reference %s', async (reference) => {
    const [{ default: JSZip }, { extractAudio }] = await Promise.all([
      import('jszip'),
      import('../src/importer/pptx'),
    ]);
    const zip = new JSZip();
    zip.file('ppt/media/source.wav', new Uint8Array([1]));
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      '<Relationships><Relationship Id="sound" Type="urn:rels/audio" Target="../media/source.wav"/></Relationships>',
    );
    const root = xml(
      `<p:sld xmlns:p="urn:p" xmlns:a="urn:a" xmlns:r="urn:r"><p:sp><p:nvSpPr><p:cNvPr id="9" name="Sound"/>${reference}</p:nvSpPr></p:sp></p:sld>`,
    );
    const urls: string[] = [];
    try {
      expect(await extractAudio(zip, 'ppt/slides/slide1.xml', root, urls, [])).toHaveLength(1);
    } finally {
      urls.forEach(URL.revokeObjectURL);
    }
  });
  it('ignores points outside or degenerate audio polygons', async () => {
    const { pointInAudioArea } = await import('../src/core/audioObjects');
    expect(
      pointInAudioArea({ x: 3, y: 2 }, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toBe(true);
    expect(
      pointInAudioArea({ x: 8, y: 2 }, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toBe(false);
    expect(
      pointInAudioArea({ x: 3, y: 2 }, [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false);
  });
});
