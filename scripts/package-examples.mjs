import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A source-only, deterministic ZIP. No dependencies, credentials or build output.
const root = fileURLToPath(new URL("../examples/ai-course/", import.meta.url));
const output = fileURLToPath(new URL("../public/downloads/ai-course.zip", import.meta.url));
function collect(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || ["bin", "obj"].includes(entry.name)) return [];
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return collect(path.join(directory, entry.name), `${relative}/`);
    return entry.isFile() && /\.(cs|csproj|json|md)$/.test(entry.name) ? [relative] : [];
  });
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunks = [], central = [];
let offset = 0;
const files = collect(root).sort();
for (const relative of files) {
  const name = Buffer.from(`ai-course/${relative}`);
  const data = readFileSync(path.join(root, relative));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(0x21, 12); // 1980-01-01, fixed for reproducible archives
  header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  chunks.push(header, name, data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); header.copy(entry, 6, 4, 30);
  entry.writeUInt32LE(offset, 42); central.push(entry, name);
  offset += header.length + name.length + data.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([...chunks, directory, end]));
console.log(`Packaged ${files.length} source files into public/downloads/ai-course.zip`);
