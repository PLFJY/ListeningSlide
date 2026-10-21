import { XMLParser, XMLValidator } from 'fast-xml-parser';
export interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
}
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  removeNSPrefix: false,
  trimValues: false,
  processEntities: false,
});
export function xml(source: string): XNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('课件包含不受支持的 XML 实体声明。');
  if (XMLValidator.validate(source) !== true) throw new Error('课件 XML 文件损坏。');
  function nodes(values: any[]): XNode[] {
    return values.flatMap((value) =>
      Object.entries(value)
        .filter(([k]) => k !== ':@' && !k.startsWith('?') && k !== '#text')
        .map(([key, children]) => ({
          name: key.split(':').pop()!,
          attrs: Object.fromEntries(
            Object.entries(value[':@'] || {}).map(([k, v]) => [k.replace(/^@_/, ''), String(v)]),
          ),
          children: nodes(Array.isArray(children) ? children : []),
        })),
    );
  }
  return { name: 'root', attrs: {}, children: nodes(parser.parse(source)) };
}
export function all(node: XNode, name: string): XNode[] {
  return node.children.flatMap((n) => [...(n.name === name ? [n] : []), ...all(n, name)]);
}
export function first(node: XNode, name: string): XNode | undefined {
  for (const n of node.children) {
    if (n.name === name) return n;
    const found = first(n, name);
    if (found) return found;
  }
}
export function resolvePart(base: string, target: string) {
  const parts = (
    target.startsWith('/')
      ? target.slice(1)
      : `${base.slice(0, base.lastIndexOf('/') + 1)}${target}`
  ).split('/');
  const result: string[] = [];
  for (const p of parts) {
    if (p === '..') result.pop();
    else if (p && p !== '.') result.push(p);
  }
  return result.join('/');
}
export function parseTime(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|min|h)?\s*$/i.exec(value);
  if (match)
    return (
      Number(match[1]) * { ms: 0.001, s: 1, min: 60, h: 3600 }[match[2]?.toLowerCase() || 'ms']!
    );
  const clock = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);
  if (clock) return +clock[1] * 3600 + +clock[2] * 60 + +clock[3];
  throw new Error(`无法识别媒体时间：${value}`);
}
