import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import type { ConvertedPresentation } from '../src/slideshow/types';
const run = promisify(execFile);
const MAX_BYTES = 256 * 1024 * 1024;
const xml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export async function convertPresentation(
  input: Uint8Array,
  runtime: string,
  temporary: string,
): Promise<ConvertedPresentation> {
  if (
    !(input instanceof Uint8Array) ||
    input.length < 4 ||
    input.length > MAX_BYTES ||
    input[0] !== 80 ||
    input[1] !== 75
  )
    throw new Error('请选择小于 256 MB 的有效 PPTX。');
  const zip = await JSZip.loadAsync(input);
  // Check central-directory sizes before handing the file to the native converter.
  let expanded = 0;
  for (const file of Object.values(zip.files)) {
    expanded +=
      (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    if (expanded > 512 * 1024 * 1024) throw new Error('PPTX 解压体积超过 512 MB。');
    if (
      file.name.startsWith('/') ||
      file.name.split(/[\\/]/).includes('..') ||
      (file as unknown as { unsafeOriginalName?: string }).unsafeOriginalName
        ?.split(/[\\/]/)
        .includes('..')
    )
      throw new Error('PPTX 包含不安全的资源路径。');
  }
  if (!zip.file('ppt/presentation.xml')) throw new Error('文件不包含 PowerPoint 演示文稿。');
  const platform = `${process.platform}-${process.arch}`;
  const converterDir = path.join(runtime, platform, 'converter');
  const executable = path.join(converterDir, process.platform === 'win32' ? 'x2t.exe' : 'x2t');
  const manifest = JSON.parse(
    await fs.readFile(path.join(runtime, platform, 'provenance.json'), 'utf8').catch(() => {
      throw new Error(
        `缺少已校验的官方 ONLYOFFICE 10.0.0 ${platform} 转换组件；请运行 pnpm run onlyoffice:prepare。`,
      );
    }),
  );
  if (
    manifest.version !== '10.0.0' ||
    !manifest.sha256 ||
    !manifest.source?.startsWith(
      'https://github.com/ONLYOFFICE/DesktopEditors/releases/download/v10.0.0/',
    )
  )
    throw new Error('转换组件来源或版本未核验。');
  const job = await fs.mkdtemp(path.join(temporary, 'listeningslide-convert-'));
  try {
    const output = path.join(job, 'output');
    const temp = path.join(job, 'temp');
    await fs.mkdir(output);
    await fs.mkdir(temp);
    await fs.writeFile(path.join(job, 'input.pptx'), input);
    const fields: Record<string, string> = {
      m_sFileFrom: path.join(job, 'input.pptx'),
      m_sFileTo: path.join(output, 'Editor.bin'),
      m_nFormatTo: '8195',
      m_sTempDir: temp,
      m_bIsNoBase64: 'false',
      // Use the same source font set as the generated browser fonts.
      m_sFontDir: path.join(runtime, 'font-input'),
    };
    const params = path.join(job, 'params.xml');
    await fs.writeFile(
      params,
      `<TaskQueueDataConvert>${Object.entries(fields)
        .map(([key, value]) => `<${key}>${xml(value)}</${key}>`)
        .join('')}</TaskQueueDataConvert>`,
    );
    await run(executable, [params], {
      cwd: converterDir,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const binary = new Uint8Array(await fs.readFile(path.join(output, 'Editor.bin')));
    if (binary.length > MAX_BYTES || Buffer.from(binary.subarray(0, 5)).toString() !== 'PPTY;')
      throw new Error('官方转换组件没有生成有效 PPTY。');
    let mediaBytes = 0;
    const media: ConvertedPresentation['media'] = [];
    async function collect(folder: string, prefix = 'media/') {
      for (const entry of await fs.readdir(folder, { withFileTypes: true }).catch(() => [])) {
        if (entry.isDirectory())
          await collect(path.join(folder, entry.name), `${prefix}${entry.name}/`);
        else if (entry.isFile()) {
          const file = path.join(folder, entry.name);
          mediaBytes += (await fs.stat(file)).size;
          if (mediaBytes > MAX_BYTES) throw new Error('转换后的媒体资源超过 256 MB。');
          media.push({ name: prefix + entry.name, data: new Uint8Array(await fs.readFile(file)) });
        }
      }
    }
    await collect(path.join(output, 'media'));
    return { binary, media };
  } catch (error) {
    throw new Error(
      `ONLYOFFICE 本地转换失败：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await fs.rm(job, { recursive: true, force: true });
  }
}
