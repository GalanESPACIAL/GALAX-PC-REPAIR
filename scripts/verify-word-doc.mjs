import fs from 'node:fs';
import path from 'node:path';
const p = path.join(process.cwd(), 'docs', 'word', 'PROYECTO_GALAX_PC_REPAIR_Airi.docx');
const buf = fs.readFileSync(p);
console.log('SIZE', buf.length, 'SIG', buf.slice(0, 2).toString());
console.log('ZIP OK', buf.readUInt32LE(0) === 0x04034b50);
// Extraer document.xml del ZIP (store) leyendo entradas locales
let off = 0, found = null;
while (off < buf.length && buf.readUInt32LE(off) === 0x04034b50) {
  const nlen = buf.readUInt16LE(off + 26), elen = buf.readUInt16LE(off + 28);
  const csize = buf.readUInt32LE(off + 18), name = buf.slice(off + 30, off + 30 + nlen).toString();
  const start = off + 30 + nlen + elen;
  if (name === 'word/document.xml') found = buf.slice(start, start + csize).toString('utf8');
  off = start + csize;
  if (buf.readUInt32LE(off) === 0x02014b50) break;
}
const text = [...found.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' ');
console.log('DOCUMENT XML', found.length, 'TEXT CHARS', text.length);
console.log('TITLE PRESENT', text.includes('GALAX PC REPAIR: REDISEÑO DEL CHATBOX DE AIRI'));
console.log('SECTIONS', (text.match(/1\. Descripción|13\. Anexos/g) || []).length);
console.log('PLACEHOLDERS', /XXXXX|PROYECTO X|Título del/.test(text));
console.log('SAMPLE:', text.slice(0, 450));
