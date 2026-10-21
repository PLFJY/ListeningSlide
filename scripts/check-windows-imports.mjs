import { promises as fs } from 'node:fs';
import path from 'node:path';
// Read PE import tables so extraction can retain app-local C/C++ runtime DLLs.
export function peImports(bytes) {
  const pe = bytes.readUInt32LE(60);
  if (bytes.subarray(pe, pe + 4).toString('hex') !== '50450000') return [];
  const sections = bytes.readUInt16LE(pe + 6),
    optionalSize = bytes.readUInt16LE(pe + 20),
    optional = pe + 24;
  const directory = optional + (bytes.readUInt16LE(optional) === 0x20b ? 112 : 96);
  const importsRva = bytes.readUInt32LE(directory + 8);
  if (!importsRva) return [];
  const offset = (rva) => {
    for (let index = 0; index < sections; index++) {
      const start = optional + optionalSize + index * 40;
      const virtualSize = bytes.readUInt32LE(start + 8),
        address = bytes.readUInt32LE(start + 12),
        rawSize = bytes.readUInt32LE(start + 16),
        raw = bytes.readUInt32LE(start + 20);
      if (rva >= address && rva < address + Math.max(virtualSize, rawSize))
        return raw + rva - address;
    }
    return rva;
  };
  const result = [];
  for (let cursor = offset(importsRva); cursor + 20 <= bytes.length; cursor += 20) {
    if (bytes.subarray(cursor, cursor + 20).every((value) => value === 0)) break;
    const start = offset(bytes.readUInt32LE(cursor + 12));
    result.push(bytes.subarray(start, bytes.indexOf(0, start)).toString('ascii'));
  }
  return result;
}
if (process.argv[1] && path.basename(process.argv[1]) === 'check-windows-imports.mjs') {
  const folder = process.argv[2];
  const files = await fs.readdir(folder);
  const local = new Set(files.map((file) => file.toLowerCase()));
  const imports = {};
  for (const file of files.filter((file) => /\.(exe|dll)$/i.test(file)))
    imports[file] = peImports(await fs.readFile(path.join(folder, file)));
  const external = [...new Set(Object.values(imports).flat())]
    .filter((name) => !local.has(name.toLowerCase()))
    .sort();
  console.log(JSON.stringify({ folder, imports, external }, null, 2));
}
