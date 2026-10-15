// Bounded, uncompressed ZIP32. Names are generated from validated UUID paths.
// Independent integration tests read the resulting archive using Python zipfile.
export function zipFiles(files) {
  if (files.length > 1000) throw new Error('Export has too many files');
  const parts = []; const directory = []; const seen = new Set(); let offset = 0; let total = 0;
  const encoder = new TextEncoder();
  for (const { name, bytes } of files) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.startsWith('/') || name.split('/').some(x => !x || x === '.' || x === '..') || seen.has(name)) throw new Error('Invalid archive path');
    seen.add(name); total += bytes.length;
    if (total > 32 * 1024 * 1024) throw new Error('Export exceeds preview size limit');
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const filename = encoder.encode(name);
    const local = new Uint8Array(30 + filename.length); const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, filename.length, true); local.set(filename, 30);
    parts.push(local, bytes);
    const central = new Uint8Array(46 + filename.length); const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, filename.length, true); c.setUint32(42, offset, true); central.set(filename, 46);
    directory.push(central); offset += local.length + bytes.length;
  }
  const directorySize = directory.reduce((n, bytes) => n + bytes.length, 0);
  const end = new Uint8Array(22); const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + 22); let cursor = 0;
  for (const bytes of [...parts, ...directory, end]) { result.set(bytes, cursor); cursor += bytes.length; }
  return result;
}
