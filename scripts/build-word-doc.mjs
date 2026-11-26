import fs from 'node:fs';
import path from 'node:path';

/* ---------- ZIP (store) sin dependencias ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = f.data, crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); name.copy(local, 30);
    parts.push(local, data);
    const cen = Buffer.alloc(46 + name.length);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8); cen.writeUInt16LE(0, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36); cen.writeUInt32LE(0, 38); cen.writeUInt32LE(offset, 42);
    name.copy(cen, 46); central.push(cen);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

/* ---------- Helpers OOXML ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RPR = (size, bold, color) => `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
function p(text, opts = {}) {
  const { size = 24, bold = false, align = 'both', color = '', space = 160, pageBreak = false, indent = 0 } = opts;
  const jc = align === 'center' || align === 'left' || align === 'right' ? `<w:jc w:val="${align}"/>` : '';
  const br = pageBreak ? '<w:r><w:br w:type="page"/></w:r>' : '';
  const ind = indent ? `<w:ind w:left="${indent}"/>` : '';
  const paras = String(text).split('\n');
  const runs = paras.map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${RPR(size, bold, color)}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join('');
  return `<w:p><w:pPr>${jc}${ind}<w:spacing w:after="${space}" w:line="300" w:lineRule="auto"/>${RPR(size, bold, color)}</w:pPr>${br}${runs}</w:p>`;
}
function heading(text) { return p(text.toUpperCase(), { size: 28, bold: true, align: 'left', space: 200 }); }
function bullet(text) { return p('•  ' + text, { size: 23, align: 'left', space: 90, indent: 240 }); }
function title(text) { return p(text.toUpperCase(), { size: 32, bold: true, align: 'center', space: 240 }); }
function center(text, size = 24, bold = false) { return p(text, { size, bold, align: 'center', space: 140 }); }

/* ---------- Contenido ---------- */
const template = 'C:/Users/Supremo-Pride/AppData/Local/Temp/opencode/docxtpl/word/document.xml';
const tpl = fs.readFileSync(template, 'utf8');
const ds = tpl.indexOf('<w:drawing>'), de = tpl.indexOf('</w:drawing>', ds) + 12;
const drawing = tpl.slice(ds, de);
const sectEnd = tpl.slice(tpl.indexOf('<w:sectPr'), tpl.indexOf('</w:sectPr>') + 11);

const parts = [];
parts.push(center('INSTITUTO DE EDUCACIÓN SUPERIOR PRIVADO "JOSÉ SANTOS CHOCANO"', 24, true));
parts.push(center('HUARAL', 22));
parts.push(center('PROGRAMA DE ESTUDIO DE', 22));
parts.push(center('DESARROLLO DE SISTEMAS DE INFORMACIÓN', 24, true));
parts.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>${drawing}</w:p>`);
parts.push(title('GALAX PC REPAIR: rediseño del chatbox de Airi'));
parts.push(center('Documentación técnica integral del asistente virtual', 24));
parts.push(p('', { space: 400 }));
parts.push(center('GalanESPACIAL', 24, true));
parts.push(center('Asesor: Equipo de desarrollo GALAX PC REPAIR', 22));
parts.push(center('Lima – Perú, 2026', 22));

parts.push(heading('Dedicatoria', true).replace('DEDICATORIA', 'Dedicatoria'));
parts.push(p('Dedico este trabajo a los clientes de GALAX PC REPAIR, cuya necesidad de información clara sobre equipos, precios y stock motivó el rediseño del asistente Airi.', { pageBreak: true }));

parts.push(p('Agradecimiento', { size: 28, bold: true, align: 'left', pageBreak: true }));
parts.push(p('Agradezco al equipo de GALAX PC REPAIR por proporcionar el catálogo real, las fotografías de los productos y el modelo 3D de Airi, elementos sin los cuales esta documentación no tendría valor.'));

parts.push(p('Índice', { size: 28, bold: true, align: 'left', pageBreak: true }));
const index = [
  '1. Descripción de la problemática', '2. Planteamiento de la problemática', '3. Definición y justificación del problema',
  '4. Objetivos del proyecto', '5. Población beneficiada con el proyecto', '6. Bases teóricas', '7. Costos',
  '8. Metodología', '9. Planificación del Proyecto', '10. Recursos y materiales utilizados',
  '11. Resultados o conclusiones y recomendaciones', '12. Bibliografía', '13. Anexos'
];
index.forEach((x) => parts.push(bullet(x)));

const sections = [
  ['1. Descripción de la problemática', [
    'La tienda GALAX PC REPAIR contaba con un asistente virtual cuya interfaz presentaba errores de ejecución (waveLow is not defined), respuestas genéricas sin conexión con el catálogo real y una experiencia visual inconsistente entre la página principal y la previsualización.',
    'El atlas geográfico y sociocultural corresponde a clientes Perú, con atención comercial en Lima. El visitante necesita consultar laptops, computadoras, componentes, servicios técnicos, pagos y envíos sin depender de software local (XAMPP/Apache/MySQL).'
  ]],
  ['2. Planteamiento de la problemática', [
    'Causa: implementación fragmentada del chatbox, ausencia de un motor de respuestas basado en datos reales y dependencia de una infraestructura PHP que el visitante no posee.',
    'Problema: el cliente no podía obtener información confiable de productos ni interactuar con un asistente visualmente profesional y accesible.',
    'Consecuencias: pérdida de confianza, consultas repetidas por WhatsApp y una experiencia de compra menos clara. El pronóstico sin intervención era la continuidad de una interfaz rota y respuestas no verificables.'
  ]],
  ['3. Definición y justificación del problema', [
    'Se define el problema como la falta de un canal de atención automatizado, visualmente coherente y estrictamente basado en el catálogo real de GALAX PC REPAIR.',
    'Su justificación radica en que el catálogo cuenta con 209 productos reales (200 del inventario y 9 del seed), 15 marcas, 7 categorías y precios entre S/ 199 y S/ 59,999. Aprovechar esos datos evita inventar precios o existencias y mejora la atención al cliente.'
  ]],
  ['4. Objetivos del proyecto', [
    'Diseñar un chatbox moderno, elegante y futurista, con interfaz oscura azul marino/negra y efectos luminosos azules y violetas.',
    'Implementar un avatar de Airi visible y bien integrado, con cuerpo 3D animado del modelo Sanara real del proyecto.',
    'Integrar búsqueda por nombre, categoría, características y precio, consulta de stock real y respuestas sobre reparaciones, gaming, pagos y envíos.',
    'Mantener conversaciones continuas con contexto, entrada de texto, imágenes, cámara, audio y micrófono.',
    'Validar el funcionamiento en escritorio, tablet y celular, sin errores de JavaScript y con rendimiento optimizado.'
  ]],
  ['5. Población beneficiada con el proyecto', [
    'Se benefician los clientes actuales y potenciales de GALAX PC REPAIR en Perú, especialmente quienes buscan laptops, computadoras y accesorios con información verificable de precio y stock.',
    'También se beneficia el equipo comercial, que recibe consultas mejor orientadas y con códigos de producto reales.'
  ]],
  ['6. Bases teóricas', [
    'Frontend estático: HTML, CSS y JavaScript sin build, publicado en GitHub Pages. El catálogo se consume desde assets/data/catalog.json.',
    'Supabase: PostgreSQL, Auth, Storage y Edge Functions como backend opcional, con Row Level Security para proteger datos de clientes.',
    'WebGL y three.js: renderizado del modelo GLB de Sanara con materiales PBR, animación por huesos y encuadre de cámara para mostrar el rostro.',
    'Web Speech API: síntesis de voz (TTS) y reconocimiento de voz (STT) en español, sujetos a soporte del navegador.',
    'UI/UX y accesibilidad: contraste, role="dialog", aria-live, foco visible y prefers-reduced-motion.'
  ]],
  ['7. Costos', [
    'GitHub Pages: sin costo para repositorios públicos.',
    'Supabase: plan gratuito disponible para el proyecto; el costo de producción dependerá del plan contratado.',
    'three.js y Font Awesome: bibliotecas de código abierto incluidas localmente o vía CDN público.',
    'Dominio propio: no requerido; el sitio se publica en el subdominio oficial de GitHub Pages.'
  ]],
  ['8. Metodología', [
    'Se trabajó en ocho etapas: (1) inspección del chatbox actual, (2) identificación de archivos y dependencias, (3) rediseño de la interfaz, (4) mejora de interacciones, (5) integración de funciones existentes, (6) corrección de errores, (7) pruebas y (8) optimización y publicación.',
    'Cada etapa se ejecutó de forma autónoma, conservando las funciones que ya funcionaban y documentando las integraciones pendientes.'
  ]],
  ['9. Planificación del Proyecto', [
    'Se publicaron commits secuenciales en la rama main: corrección del bucle 3D, reconstrucción del chatbox con motor de catálogo real, incorporación del cuerpo 3D protagonista, publicación de las fotos reales de laptops, unificación de tarjetas de producto y barra de acciones funcional.',
    'URL oficial de trabajo: https://galanespacial.github.io/GALAX-PC-REPAIR/docs/galax_preview.html'
  ]],
  ['10. Recursos y materiales utilizados', [
    'Archivo principal: docs/galax_preview.html (toda la interfaz, estilos, motor de respuestas y lógica de acciones).',
    'Datos: assets/data/catalog.json y libros de inventario docs/inventario_categoria1.sql y database/supabase/002_seed_postgres.sql.',
    'Modelo 3D: docs/Cuerpo_SANARA IA/sanara_listo.glb, con animación Levitate_Idle.',
    'Librerías: docs/vendor/three.module.js y docs/vendor/loaders/GLTFLoader.js; iconos Font Awesome.',
    'Fotografías reales: docs/producto/Laptop/Laptop-HP-Pavilion-15, docs/producto/Laptop/Laptop-Lenovo-IdeaPad-3 y docs/producto/Laptop/Lenovo Legion Y540.',
    'Video real: docs/producto/Monitores/Monitor Samsung 24 Full HD 75Hz.'
  ]],
  ['11. Resultados o conclusiones y recomendaciones', [
    'El chatbox quedó integrado con el catálogo real: devuelve fichas con nombre, precio, código, stock y especificaciones. No inventa productos, precios ni existencias.',
    'Las siete tarjetas de producto muestran imagen completa (object-fit: contain), barra de acciones con corazón, comentarios, cámara con contador dinámico y botón de video condicional.',
    'El contador de fotos es exacto: HP Pavilion 15 = 3, Lenovo IdeaPad 3 = 3, Lenovo Legion Y540 = 1, Computadoras gaming = 0 y Monitor Samsung = 3. Solo el Monitor Samsung posee video registrado.',
    'Las pruebas en local y en producción reportaron cero errores de consola y correcta carga de imágenes.',
    'Se recomienda, como siguiente etapa, configurar Supabase (URL y anon key), desplegar las Edge Functions de IA y visión, y obtener credenciales oficiales de pasarela de pago para habilitar tarjetas.'
  ]],
  ['12. Bibliografía', [
    'MDN Web Docs. Referencia de HTML, CSS, Web Speech API y WebGL.',
    'three.js Documentation. GLTFLoader y MeshStandardMaterial.',
    'Supabase Docs. PostgreSQL, Auth, Storage, Edge Functions y Row Level Security.',
    'GitHub Docs. GitHub Pages y publicación de sitios estáticos.',
    'W3C. Web Content Accessibility Guidelines (WCAG).'
  ]],
  ['13. Anexos', [
    'Anexo A — URL del proyecto: https://galanespacial.github.io/GALAX-PC-REPAIR/docs/galax_preview.html',
    'Anexo B — Estructura de datos: catalog.json contiene meta, categories, brands, products, services, showcase y gallery.',
    'Anexo C — Verificación realizada: apertura del chat, búsquedas, accesos rápidos, favoritos, comentarios, galería, video, imágenes y cierre sin errores.',
    'Anexo D — Estados de favoritos y comentarios se guardan en localStorage del navegador (galax_preview_favorites y galax_preview_reviews).'
  ]]
];
sections.forEach(([h, lines], i) => {
  parts.push(p(h, { size: 28, bold: true, align: 'left', pageBreak: i === 0 }));
  lines.forEach((l) => parts.push(p(l, { size: 24 })));
});
parts.push(p('Fin del documento.', { size: 22, align: 'center', space: 0 }));

const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  tpl.slice(0, tpl.indexOf('<w:body>') + 8) + parts.join('') + sectEnd + '</w:body></w:document>';

/* ---------- Ensamblar y comprimir ---------- */
const src = 'C:/Users/Supremo-Pride/AppData/Local/Temp/opencode/docxtpl';
const outDir = path.join(process.cwd(), 'docs', 'word');
fs.mkdirSync(outDir, { recursive: true });
const files = [];
function walk(dir, rel = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name), r = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isDirectory()) walk(full, r);
    else files.push({ name: r, data: fs.readFileSync(full) });
  }
}
walk(src);
for (const f of files) if (f.name === 'word/document.xml') f.data = Buffer.from(documentXml, 'utf8');
const dest = path.join(outDir, 'PROYECTO_GALAX_PC_REPAIR_Airi.docx');
fs.writeFileSync(dest, makeZip(files));
console.log('OK', dest, Math.round(fs.statSync(dest).size / 1024) + ' KB', 'paragraphs', parts.length);
