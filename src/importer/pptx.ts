import JSZip from 'jszip';
import type { AudioTrack, Presentation } from '../core/model';
import { xml, all, first, resolvePart, parseTime, type XNode } from './xml';
const mimeTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  wma: 'audio/x-ms-wma',
};
interface Rel {
  id: string;
  target: string;
  type: string;
  external: boolean;
}
async function relationships(zip: JSZip, part: string): Promise<Rel[]> {
  const relPath = `${part.slice(0, part.lastIndexOf('/') + 1)}_rels/${part.slice(part.lastIndexOf('/') + 1)}.rels`;
  const file = zip.file(relPath);
  if (!file) return [];
  return all(xml(await file.async('string')), 'Relationship').map((n) => ({
    id: n.attrs.Id,
    target: resolvePart(part, n.attrs.Target),
    type: n.attrs.Type,
    external: n.attrs.TargetMode === 'External',
  }));
}
export async function extractAudio(
  zip: JSZip,
  part: string,
  root: XNode,
  urls: string[],
  warnings: string[],
  resources = new Map<string, string>(),
): Promise<AudioTrack[]> {
  const rels = await relationships(zip, part);
  const tracks: AudioTrack[] = [];
  async function visit(node: XNode) {
    if (['pic', 'sp', 'graphicFrame'].includes(node.name)) {
      const identity = first(node, 'cNvPr');
      const id = identity?.attrs.id;
      const refs = [
        ...all(node, 'media'),
        ...all(node, 'audioFile'),
        ...all(node, 'wavAudioFile'),
        ...all(node, 'snd'),
        ...all(node, 'hlinkClick'),
      ];
      const candidates = refs
        .map((ref) =>
          rels.find(
            (r) =>
              r.id ===
              (ref.attrs['r:link'] ||
                ref.attrs['r:embed'] ||
                ref.attrs.link ||
                ref.attrs.embed ||
                ref.attrs['r:id']),
          ),
        )
        .filter(
          (r): r is Rel =>
            !!r &&
            (r.type.endsWith('/audio') || /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(r.target)),
        );
      const relation =
        candidates.find((relation) => !relation.external && zip.file(relation.target)) ||
        candidates[0];
      if (relation && id) {
        if (relation.external) {
          warnings.push(`音频“${identity?.attrs.name || id}”为外部链接，离线无法加载。`);
          return;
        }
        const file = zip.file(relation.target);
        if (!file) {
          warnings.push(`音频资源缺失：${relation.target}`);
          return;
        }
        const ext = relation.target.split('.').pop()!.toLowerCase();
        // Many slides reference the same large MP3. Share immutable bytes/URL,
        // while each track keeps its own Audio element, trim and playback state.
        let src = resources.get(relation.target);
        if (!src) {
          src = URL.createObjectURL(
            new Blob([await file.async('arraybuffer')], {
              type: mimeTypes[ext] || 'application/octet-stream',
            }),
          );
          resources.set(relation.target, src);
          urls.push(src);
        }
        const trim = first(node, 'trim');
        let trimStart = 0,
          trimEnd = 0,
          trimError: string | undefined;
        try {
          trimStart = parseTime(trim?.attrs.st);
          trimEnd = parseTime(trim?.attrs.end);
        } catch (e) {
          trimError = String(e);
          warnings.push(trimError);
        }
        tracks.push({
          id: `${part}:${id}`,
          shapeId: id,
          name: identity?.attrs.name || relation.target.split('/').pop()!,
          src,
          trimStart,
          trimEnd,
          trimError,
        });
        if (ext === 'wma')
          warnings.push('WMA 在 Chromium 中通常无法解码；请在 PowerPoint 中替换为 MP3/WAV。');
      }
    }
    for (const c of node.children) await visit(c);
  }
  await visit(root);
  return tracks;
}
export async function importPptx(
  data: ArrayBuffer | Uint8Array,
  onProgress?: (message: string) => void,
): Promise<Presentation> {
  const urls: string[] = [];
  try {
    if (data.byteLength > 256 * 1024 * 1024) throw new Error('课件不能超过 256 MB。');
    onProgress?.('正在读取课件…');
    const zip = await JSZip.loadAsync(data);
    let inflated = 0;
    const files = Object.values(zip.files);
    if (files.length > 20000) throw new Error('课件文件条目过多。');
    for (const entry of files) {
      inflated += (entry as any)._data?.uncompressedSize || 0;
      if (inflated > 768 * 1024 * 1024)
        throw new Error('解压后的课件超过 768 MB，请压缩媒体后重试。');
    }
    const pres = zip.file('ppt/presentation.xml');
    if (!pres) throw new Error('这不是有效的 PowerPoint PPTX 文件。');
    const root = xml(await pres.async('string')),
      relations = await relationships(zip, 'ppt/presentation.xml');
    const order = all(root, 'sldId')
      .map((n) => relations.find((r) => r.id === (n.attrs['r:id'] || n.attrs.id))?.target)
      .filter((p): p is string => !!p);
    if (!order.length) throw new Error('课件中没有可播放的幻灯片。');
    const warnings: string[] = [];
    // Parse supplemental XML before rendering; validate XML and never fetch linked media.
    const slides = [];
    const mediaResources = new Map<string, string>();
    for (let i = 0; i < order.length; i++) {
      const file = zip.file(order[i]);
      if (!file) throw new Error(`第 ${i + 1} 页资源缺失。`);
      const slideRoot = xml(await file.async('string'));
      slides.push({
        id: order[i],
        audios: await extractAudio(zip, order[i], slideRoot, urls, warnings, mediaResources),
      });
    }
    onProgress?.(`正在还原 ${order.length} 页幻灯片…`);
    if (!window.desktop?.convertPresentation)
      throw new Error('本地转换需要 Electron。请运行 pnpm run dev。');
    const converted = await window.desktop.convertPresentation(new Uint8Array(data));
    const size = first(root, 'sldSz');
    const width = (Number(size?.attrs.cx) * 96) / 914400 || 960;
    const height = (Number(size?.attrs.cy) * 96) / 914400 || 540;
    return {
      width,
      height,
      slides,
      converted,
      warnings: [...new Set(warnings)],
      dispose: () => urls.forEach(URL.revokeObjectURL),
    };
  } catch (e) {
    urls.forEach(URL.revokeObjectURL);
    throw e;
  }
}
