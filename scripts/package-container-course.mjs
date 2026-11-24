import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A deterministic source-only ZIP; never package build output or secrets.
const allowed = /\.(cs|csproj|java|xml|properties|conf|sql|html|sh|json|md|yaml|yml)$/i;

function collect(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["bin", "obj", "target", "backups", "scratch", "kind-logs", "audit-debug"].includes(entry.name) || (entry.name.startsWith(".") && ![".dockerignore", ".gitignore"].includes(entry.name))) return [];
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return collect(path.join(directory, entry.name), `${relative}/`);
    return entry.isFile() && (allowed.test(entry.name) || ["Dockerfile", ".dockerignore", ".gitignore"].includes(entry.name))
      ? [relative]
      : [];
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

function packageCourse(name) {
  const root = fileURLToPath(new URL(`../examples/${name}/`, import.meta.url));
  const output = fileURLToPath(new URL(`../public/downloads/${name}.zip`, import.meta.url));
  const chunks = [], central = [];
  let offset = 0;
  const files = collect(root).sort();
  for (const relative of files) {
    const entryName = Buffer.from(`${name}/${relative}`);
    const data = readFileSync(path.join(root, relative));
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(0x21, 12); // fixed date for reproducible archives
    header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(entryName.length, 26);
    chunks.push(header, entryName, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); header.copy(entry, 6, 4, 30);
    entry.writeUInt32LE(offset, 42); central.push(entry, entryName);
    offset += header.length + entryName.length + data.length;
  }

  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, Buffer.concat([...chunks, directory, end]));
  console.log(`Packaged ${files.length} source files into public/downloads/${name}.zip`);
}

packageCourse("container-course");
packageCourse("docker-labs");
packageCourse("k8s-labs");
