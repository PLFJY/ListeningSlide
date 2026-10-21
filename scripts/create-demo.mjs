import { jsonToPptx, pptxToStandard } from '@fefeding/ppt-parser';
import JSZip from 'jszip';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
// A short, low-volume synthesized cue; self-contained and royalty free.
const rate = 22050,
  duration = 12,
  samples = rate * duration,
  wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const f = [261.63, 329.63, 392, 523.25][Math.floor(t) % 4];
  const env = Math.min(1, (t % 1) * 12) * Math.max(0, 1 - (t % 1));
  wav.writeInt16LE(Math.round(Math.sin(t * f * 2 * Math.PI) * 0.13 * 32767 * env), 44 + i * 2);
}
const text = (value, x, y, width, height, fontSize = 24, color = '#304d41', more = {}) => ({
  type: 'text',
  text: value,
  x,
  y,
  width,
  height,
  fontSize,
  fontFace: 'Arial',
  color,
  ...more,
});
const rect = (x, y, width, height, color, more = {}) => ({
  type: 'shape',
  shapeType: 'rect',
  x,
  y,
  width,
  height,
  fill: { color },
  line: 'none',
  ...more,
});
const label = (n) => [
  text('LISTENING LAB', 70, 45, 500, 24, 11, '#6c8c7d', { bold: true }),
  text(`CLASSROOM DEMO     /     ${n} OF 03`, 905, 46, 300, 22, 9, '#8fa697'),
];
const poster = (await readFile('build/icon.png')).toString('base64');
const audio = (name, x, y = 554) => ({
  type: 'audio',
  name,
  x,
  y,
  width: 42,
  height: 42,
  extension: 'wav',
  data: wav.toString('base64'),
  poster: { data: poster, extension: 'png' },
});
const slides = [
  {
    background: '#f8faf5',
    elements: [
      ...label('01'),
      text('Listen.', 70, 130, 1100, 96, 66),
      text('Pause. Understand.', 70, 230, 1100, 96, 66, '#719383'),
      rect(72, 370, 56, 2, '#a9bfae'),
      text('A little space for a better understanding.', 72, 401, 1050, 65, 24),
      text('方向键显示答案 · 左划下一页 · 右划上一页', 72, 480, 1000, 40, 15, '#889b8e'),
      text('The answer is: GREEN', 72, 535, 780, 60, 30, '#187f62', {
        bold: true,
        name: 'Hidden answer',
      }),
      audio('演示音轨 · 裁剪 1–10 秒', 1070, 340),
      text('AUDIO', 1065, 398, 100, 25, 9, '#7d9487'),
    ],
  },
  {
    background: '#f8faf5',
    elements: [
      ...label('02'),
      text('Make every replay count.', 70, 130, 1130, 90, 46),
      text('One source. Two listening moments.', 72, 242, 1050, 60, 27, '#749381'),
      rect(72, 355, 1128, 1, '#dce7dc'),
      text('01    Listen for the main idea.', 75, 390, 1020, 55, 25),
      text('02    Listen for the details.', 75, 475, 1020, 55, 25),
      audio('片段 A · 1–10 秒', 990),
      audio('片段 B · 同源 3–8 秒', 1090),
      text('选择两段音频，观察独立的裁剪时间轴。', 75, 590, 850, 45, 15, '#889b8e'),
    ],
  },
  {
    background: '#253e33',
    elements: [
      ...label('03'),
      text('Less operating.', 70, 150, 1110, 90, 60, '#e8f2e8'),
      text('More teaching.', 70, 250, 1110, 90, 60, '#99c6ac'),
      rect(72, 400, 60, 2, '#70967d'),
      text('拖动 · 调整大小 · 折叠 · 自由回听', 72, 445, 1100, 60, 24, '#adccba'),
      text('右划返回上一页，动画与音频将回到起点。', 72, 555, 1100, 50, 15, '#7da18b'),
    ],
  },
];
let data = await jsonToPptx({
  metadata: { title: 'Listening Lab', author: 'ListeningSlide' },
  slideSize: { width: 1280, height: 720 },
  slides,
});
const zip = await JSZip.loadAsync(data);
function timing(target) {
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${target}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="7" dur="350"/><p:tgtEl><p:spTgt spid="${target}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}
for (let i = 1; i <= 3; i++) {
  const part = `ppt/slides/slide${i}.xml`;
  let xml = await zip.file(part).async('string');
  xml = xml.replace(
    '<p:sld ',
    '<p:sld xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" ',
  );
  let count = 0;
  xml = xml.replace(
    /(<a:audioFile[^>]*\/>)/g,
    (match) =>
      `${match}<p:extLst><p:ext uri="{DAA4B4D4-7520-4FA2-801F-5F27E6A7C839}"><p14:media><p14:trim st="${++count === 2 ? '3000' : '1000'}" end="${count === 2 ? '4s' : '2000'}"/></p14:media></p:ext></p:extLst>`,
  );
  if (i === 1) {
    const answerId = /<p:cNvPr id="(\d+)" name="Hidden answer"/.exec(xml)?.[1];
    if (!answerId) throw new Error('Demo answer missing');
    xml = xml.replace('</p:sld>', `${timing(answerId)}</p:sld>`);
  }
  zip.file(part, xml);
  if (i === 2) {
    const relPath = 'ppt/slides/_rels/slide2.xml.rels';
    let rel = await zip.file(relPath).async('string');
    const media = [...rel.matchAll(/Target="([^\"]*audio[^\"]*)"/g)];
    if (media.length === 2) rel = rel.replace(media[1][0], `Target="${media[0][1]}"`);
    zip.file(relPath, rel);
  }
}
data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
const check = await pptxToStandard(data);
if (check.slides.length !== 3) throw new Error('Demo round-trip failed');
await mkdir('public', { recursive: true });
await writeFile('public/demo.pptx', data);
console.log(
  'Created public/demo.pptx: 3 slides, keyboard-triggered answer, three audio objects, shared media with distinct trims.',
);
