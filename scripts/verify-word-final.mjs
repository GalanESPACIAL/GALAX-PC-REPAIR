import fs from 'node:fs';
import path from 'node:path';
const dest = path.join(process.cwd(), 'docs', 'word', 'PROYECTO_GALAX_PC_REPAIR_PEDRO_ALDAIR_ARRIASPLATA.docx');
const buf = fs.readFileSync(dest);
let off = 0; const files = {};
while (off < buf.length && buf.readUInt32LE(off) === 0x04034b50) {
  const nlen = buf.readUInt16LE(off + 26), elen = buf.readUInt16LE(off + 28), csize = buf.readUInt32LE(off + 18);
  const name = buf.slice(off + 30, off + 30 + nlen).toString(), start = off + 30 + nlen + elen;
  files[name] = buf.slice(start, start + csize);
  off = start + csize;
  if (buf.readUInt32LE(off) === 0x02014b50) break;
}
const doc = files['word/document.xml'].toString('utf8');
const text = [...doc.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' ');
const sections = ['1. Descripción de la problemática','2. Planteamiento de la problemática','3. Definición y justificación del problema','4. Objetivos generales y específicos','5. Población beneficiada','6. Bases teóricas','7. Costos','8. Metodología','9. Planificación del proyecto','10. Recursos y materiales utilizados','11. Resultados, conclusiones y recomendaciones','12. Bibliografía','13. Anexos'];
const missing = sections.filter((s) => !text.includes(s));
console.log('ZIP', buf.readUInt32LE(0) === 0x04034b50, 'DOC XML', doc.length, 'TEXT', text.length);
console.log('AUTHOR', text.includes('PEDRO ALDAIR ARRIASPLATA'), 'TITLE', text.includes('DESARROLLO E IMPLEMENTACIÓN DE UNA PLATAFORMA WEB INTELIGENTE'));
console.log('MISSING SECTIONS', missing.length ? missing : 'none');
console.log('FOOTER PART', !!files['word/footer1.xml'], 'REF', doc.includes('footerReference'), 'PAGE FIELD', files['word/footer1.xml']?.toString().includes('PAGE'));
console.log('CONTENT TYPES', files['[Content_Types].xml'].toString().includes('footer1.xml'), 'RELS', files['word/_rels/document.xml.rels'].toString().includes('footer1.xml'));
console.log('FIRST-LINE INDENTS', (doc.match(/w:firstLine="709"/g) || []).length, 'HANGING', (doc.match(/w:hanging="709"/g) || []).length);
console.log('JUSTIFIED', (doc.match(/w:jc w:val="both"/g) || []).length, 'PAGE BREAKS', (doc.match(/w:type="page"/g) || []).length);
console.log('EMPTY PARAS', (doc.match(/<w:p><w:pPr>[^<]*<\/w:pPr><\/w:p>/g) || []).length);
console.log('PLACEHOLDERS', /XXXXX|Título del|PROYECTO X/.test(text));
console.log('LOGO', doc.includes('<w:drawing>'));
const paraTexts = [...doc.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join('')).filter((t) => t.length > 50);
const seen = new Map(); let duplicates = 0;
for (const t of paraTexts) { seen.set(t, (seen.get(t) || 0) + 1); }
for (const n of seen.values()) if (n > 1) duplicates++;
console.log('DUPLICATE PARAGRAPHS', duplicates, 'BODY PARAS', paraTexts.length);
console.log('SAMPLE END:', text.slice(-420));
