import fs from 'node:fs';
import path from 'node:path';

/* ================= ZIP store (sin dependencias) ================= */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const parts = [], central = []; let offset = 0;
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
    name.copy(cen, 46); central.push(cen); offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

/* ================= Helpers OOXML ================= */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RPR = (size, bold, italic) => `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
function p(text, opts = {}) {
  const { size = 24, bold = false, italic = false, align = 'both', firstLine = 709, hanging = false, space = 140, pageBreak = false, line = 360 } = opts;
  const jc = ['center', 'left', 'right', 'both'].includes(align) ? `<w:jc w:val="${align}"/>` : '';
  const ind = hanging ? '<w:ind w:left="709" w:hanging="709"/>' : (firstLine ? `<w:ind w:firstLine="${firstLine}"/>` : '');
  const br = pageBreak ? '<w:r><w:br w:type="page"/></w:r>' : '';
  const runs = String(text).split('\n').map((lineText, i) => (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${RPR(size, bold, italic)}<w:t xml:space="preserve">${esc(lineText)}</w:t></w:r>`).join('');
  return `<w:p><w:pPr>${jc}${ind}<w:spacing w:after="${space}" w:line="${line}" w:lineRule="auto"/>${RPR(size, bold, italic)}</w:pPr>${br}${runs}</w:p>`;
}
const h = (t) => p(t.toUpperCase(), { size: 28, bold: true, align: 'left', firstLine: 0, space: 220 });
const sub = (t) => p(t, { size: 25, bold: true, align: 'left', firstLine: 0, space: 140 });
const center = (t, size = 24, bold = false) => p(t, { size, bold, align: 'center', firstLine: 0, space: 160 });
const blankLine = (t, size = 24, bold = false) => p(t, { size, bold, align: 'center', firstLine: 0, space: 180 });

/* ================= Plantilla institucional ================= */
const templatePath = 'C:/Users/Supremo-Pride/AppData/Local/Temp/opencode/docxtpl/word/document.xml';
const tpl = fs.readFileSync(templatePath, 'utf8');
const ds = tpl.indexOf('<w:drawing>'), de = tpl.indexOf('</w:drawing>', ds) + 12;
const drawing = tpl.slice(ds, de);
let sectPr = tpl.slice(tpl.indexOf('<w:sectPr'), tpl.indexOf('</w:sectPr>') + 11);
sectPr = sectPr.replace('<w:sectPr ', '<w:sectPr ').replace('>', '><w:footerReference w:type="default" r:id="rIdFooter1"/>');

const parts = [];
/* --- Portada --- */
parts.push(center('INSTITUTO DE EDUCACIÓN SUPERIOR PRIVADO "JOSÉ SANTOS CHOCANO"', 24, true));
parts.push(center('HUARAL', 22));
parts.push(center('PROGRAMA DE ESTUDIO DE', 22));
parts.push(center('DESARROLLO DE SISTEMAS DE INFORMACIÓN', 24, true));
parts.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>${drawing}</w:p>`);
parts.push(center('DESARROLLO E IMPLEMENTACIÓN DE UNA PLATAFORMA WEB INTELIGENTE DE COMERCIO ELECTRÓNICO Y SERVICIOS INFORMÁTICOS GALAX PC REPAIR', 32, true));
parts.push(center('Proyecto de desarrollo de sistemas de información', 24, false));
parts.push(center('PEDRO ALDAIR ARRIASPLATA', 26, true));
parts.push(center('Asesor: ____________________________________', 22));
parts.push(center('Huaral – Perú, 2026', 22));

/* --- Dedicatoria --- */
parts.push(p('Dedicatoria', { size: 28, bold: true, align: 'left', firstLine: 0, pageBreak: true, space: 240 }));
parts.push(p('A mi familia, por su confianza y apoyo constante durante la elaboración de este proyecto; y a las personas que confían en GALAX PC REPAIR para encontrar equipos y recibir soporte técnico.'));

/* --- Agradecimiento --- */
parts.push(p('Agradecimiento', { size: 28, bold: true, align: 'left', firstLine: 0, pageBreak: true, space: 240 }));
parts.push(p('Agradezco al Instituto de Educación Superior Privado "José Santos Chocano" por la formación recibida, y al equipo de GALAX PC REPAIR por proporcionar el catálogo real, las fotografías de los productos, el modelo tridimensional de Airi y la grabación de su voz, recursos indispensables para este trabajo.'));

/* --- Índice --- */
parts.push(p('Índice', { size: 28, bold: true, align: 'left', firstLine: 0, pageBreak: true, space: 240 }));
const index = [
  '1. Descripción de la problemática', '2. Planteamiento de la problemática', '3. Definición y justificación del problema',
  '4. Objetivos generales y específicos', '5. Población beneficiada', '6. Bases teóricas', '7. Costos',
  '8. Metodología', '9. Planificación del proyecto', '10. Recursos y materiales utilizados',
  '11. Resultados, conclusiones y recomendaciones', '12. Bibliografía', '13. Anexos'
];
index.forEach((x) => parts.push(p(x, { size: 24, align: 'left', firstLine: 0, space: 80 })));

/* ================= Contenido ================= */
const content = [
  ['1. Descripción de la problemática', [
    'GALAX PC REPAIR es una tienda tecnológica peruana dedicada a la venta de computadoras, laptops, componentes, tarjetas gráficas, procesadores, memoria RAM, almacenamiento, periféricos y accesorios, además de servicios de ensamblaje, mantenimiento, diagnóstico y reparación.',
    'La versión anterior del sitio dependía de XAMPP, Apache, PHP y MySQL/MariaDB instalados localmente. La demostración publicada en GitHub Pages mostraba una página en blanco porque varios recursos usaban rutas absolutas, y el asistente Airi presentaba un error de ejecución en el bucle de animación (waveLow is not defined) y respuestas genéricas sin relación con el catálogo real.',
    'El ámbito del problema es comercial y sociocultural: los clientes necesitan consultar precios, stock y servicios desde cualquier dispositivo sin instalar software local, y requieren información verificable antes de decidir una compra.'
  ]],
  ['2. Planteamiento de la problemática', [
    'Causa: arquitectura dependiente de servidor local, recursos publicados con rutas incorrectas, lógica del asistente duplicada y respuestas no basadas en datos reales.',
    'Problema: ausencia de una plataforma web profesional, accesible y confiable que integre catálogo, carrito, cuentas, administración y asistente inteligente con información real.',
    'Consecuencias: pérdida de confianza del visitante, consultas repetidas por WhatsApp y dificultad para mantener el sitio publicado. Sin intervención, la tienda seguiría dependiendo de entornos locales y el asistente no podría orientar al cliente.',
    'Pronóstico: con la migración a un frontend estático y backend Supabase opcional, el visitante accede sin software local y el equipo mantiene el catálogo y los pedidos en la nube.'
  ]],
  ['3. Definición y justificación del problema', [
    'Se define como la necesidad de reconstruir profesionalmente la presencia digital de GALAX PC REPAIR sobre una arquitectura estática publicada en GitHub Pages, con datos reales del inventario y un asistente virtual especializado en la tienda.',
    'La justificación se sustenta en el catálogo real del proyecto: 209 productos publicados (200 del inventario y 9 del seed), 15 marcas, 7 categorías, 6 servicios técnicos y un rango de precios de S/ 199 a S/ 59,999. Utilizar estos datos evita inventar productos, precios o existencias.'
  ]],
  ['4. Objetivos generales y específicos', [
    'Objetivo general: desarrollar e implementar una plataforma web inteligente de comercio electrónico y servicios informáticos para GALAX PC REPAIR, con identidad visual profesional, catálogo real y asistente Airi.',
    'Objetivos específicos:',
    '1. Reconstruir la tienda como frontend estático sin dependencia de XAMPP para el visitante, conservando el repositorio y la URL oficial.',
    '2. Publicar el catálogo real de 209 productos con búsqueda, filtros, ordenación y paginación.',
    '3. Implementar carrito, favoritos, cuentas de usuario, pedidos y panel administrativo con autenticación y roles.',
    '4. Integrar el asistente Airi sobre datos reales, con cuerpo 3D, voz original, síntesis femenina expresiva y entrada por imagen.',
    '5. Unificar la presentación de productos con tarjetas profesionales y barra de acciones interactiva.',
    '6. Documentar la arquitectura, la seguridad y el estado real de cada integración.',
    '7. Validar el funcionamiento en escritorio, tablet y celular, sin errores de JavaScript.',
    '8. Registrar el avance en el documento de control de 300 misiones y publicar los cambios verificados.'
  ]],
  ['5. Población beneficiada', [
    'Se benefician los clientes actuales y potenciales de GALAX PC REPAIR en Perú, en especial quienes buscan laptops, computadoras, componentes o servicios técnicos con información de precio y stock confiable.',
    'También se benefician el equipo comercial y administrativo, que cuenta con un panel para gestionar productos, pedidos y contenido, y los clientes que requieren soporte técnico o comprobantes de sus pedidos.'
  ]],
  ['6. Bases teóricas', [
    'Frontend estático: HTML, CSS y JavaScript vanilla sin.build, servido por GitHub Pages. El catálogo se consume desde assets/data/catalog.json.',
    'Supabase: PostgreSQL, Auth, Storage y Edge Functions, con Row Level Security para proteger tablas de tienda y perfiles. La clave anon Keys es pública; service_role permanece en servidor.',
    'Modelo de datos: tablas store_favorites, store_cart_items, store_orders, store_order_items, store_content, store_content_versions y store_festive_events, con RPC store_create_order para validar precio y stock en servidor.',
    'Gráficos 3D: three.js y GLTFLoader renderizan el modelo GLB de Sanara con materiales PBR y animación por huesos.',
    'Voz: Web Speech API (SpeechRecognition y speechSynthesis). El saludo usa la grabación original; las respuestas dinámicas usan TTS femenino con pitch 1.25, rate 1.09 y limpieza previa del texto.',
    'Seguridad: secretos en variables de entorno de Edge Functions, validación servidor de precios y stock, RLS y ningún número de tarjeta ni CVV almacenado en el frontend.',
    'Accesibilidad y experiencia: role="dialog", aria-live, foco visible, prefers-reduced-motion y diseño responsive.'
  ]],
  ['7. Costos', [
    'GitHub Pages: sin costo para el repositorio público donde se publica la demostración.',
    'Supabase: existe un plan gratuito; el costo de producción dependerá del plan que se contrate. Actualmente el proyecto no tiene URL ni anon key configuradas en el frontend.',
    'three.js, GLTFLoader y Font Awesome: recursos de código abierto o CDN público incluidos en el repositorio.',
    'Dominio propio: no requerido; la URL oficial es el subdominio de GitHub Pages.',
    'Pendientes de aprobación comercial (no ejecutados ni costeados en este trabajo): credenciales de Culqi para tarjeta, aprobación de API de Yape/Plin si se requiere y eventual facturación electrónica SUNAT. No se inventan montos.'
  ]],
  ['8. Metodología', [
    'Se aplicó una metodología incremental en ocho etapas: inspección del proyecto, identificación de archivos y dependencias, rediseño de la interfaz, mejora de interacciones, integración de funciones existentes, corrección de errores, pruebas y optimización con publicación.',
    'La reconstrucción partió del documento Word existente en docs/word y de la documentación técnica del repositorio: README, docs/SUPABASE_SETUP.md, docs/PAGOS.md, docs/AIRI.md, docs/SECURITY.md y docs/MASTER_PROGRESS.md.',
    'Cada cambio se publicó en commits secuenciales sobre la rama main y se verificó en servidor local y en la URL pública, registrando errores y dependencias pendientes.'
  ]],
  ['9. Planificación del proyecto', [
    'El control de avance se lleva en docs/MASTER_PROGRESS.md, con 30 fases y 300 misiones. Cada misión registra objetivo, acción técnica, archivos, criterio de aceptación, prueba de verificación y estado.',
    'La secuencia de publicación incluyó: reconstrucción del frontend estático (f80413e), corrección del bucle 3D (3937253), chatbox compacto con avatar animado (fc8cf6a), autocompletado y accesibilidad (71618af), cuerpo 3D protagonista (b9dff6e), fotos reales de laptops (d59aee1, ae4a786), tarjetas unificadas (3a9ffbc), barra de acciones (7aff88b), voz original (e6aff7a), voz por defecto (47d61f2) y motor TTS exprésivo (b0b2d69).',
    'URL de trabajo y verificación: https://galanespacial.github.io/GALAX-PC-REPAIR/docs/galax_preview.html'
  ]],
  ['10. Recursos y materiales utilizados', [
    'Estructura principal: archivos HTML en la raíz (index, tienda, producto, carrito, checkout, cuenta, favoritos, admin, servicios, contacto, nosotros, configuracion y páginas legales), assets/css/galax.css y scripts modulares en assets/js.',
    'Datos: assets/data/catalog.json (209 productos), docs/inventario_categoria1.sql y database/supabase/002_seed_postgres.sql.',
    'Backend opcional: supabase/migrations/202611260003_store_backend.sql y Edge Functions ai-chat, visual-search, create-payment y payment-webhook.',
    'Modelo 3D: docs/Cuerpo_SANARA IA/sanara_listo.glb; librerías docs/vendor/three.module.js y docs/vendor/loaders/GLTFLoader.js.',
    'Voz: docs/Voz de Airi/voz de Airi.mp3, reproducida en el saludo y disponible en el chat.',
    'Fotografías reales: docs/producto/Laptop/Laptop-HP-Pavilion-15, docs/producto/Laptop/Laptop-Lenovo-IdeaPad-3 y docs/producto/Laptop/Lenovo Legion Y540; video real del Monitor Samsung 24 Full HD 75Hz.',
    'Documentación: README.md, docs/MASTER_PROGRESS.md, docs/SUPABASE_SETUP.md, docs/PAGOS.md, docs/AIRI.md, docs/SECURITY.md y este documento Word.'
  ]],
  ['11. Resultados, conclusiones y recomendaciones', [
    'Resultados implementados y probados: tienda estática publicada sin errores de consola en 16 páginas; catálogo real con búsqueda, filtros y sugerencias; carrito y favoritos; páginas de cuenta y administración protegidas por Supabase cuando hay credenciales; Airi con respuesta sobre catálogo real, stock y temas de la tienda; avatar 3D animado; saludo con voz original; TTS femenino expresivo; imágenes y cámara con respuesta honesta; siete tarjetas de producto con barra de acciones funcional.',
    'Resultados probados localmente: apertura y cierre del chat, consultas por producto, categoría, presupuesto y stock, favoritos, comentarios, galería, reproductor de video, accesos rápidos y continuidad del contexto. La verificación en producción reportó cero errores de JavaScript.',
    'Funciones en desarrollo o pendientes: conexión real de Supabase (falta URL y anon key), despliegue de Edge Functions, análisis visual con servicio de visión, IA remota con Gemma, pagos con tarjeta mediante Culqi, cobros automáticos de Yape/Plin y factura electrónica SUNAT. Ninguna de estas funciones se simuló como exitosa.',
    'Servicios informáticos: la plataforma contempla ensamblaje, mantenimiento preventivo, diagnóstico, reparación de computadoras y soporte técnico. Sus tarifas se confirman tras evaluación del equipo; no se publican precios no aprobados.',
    'Compras y comprobantes: el checkout valida stock y precio en el servidor cuando Supabase está configurado; sin él, el pedido se guarda localmente para coordinación por WhatsApp. El recibo PNG es un comprobante comercial interno y no sustituye factura SUNAT.',
    'Conclusiones: la reconstrucción cumplió con la migración a un frontend profesional, conservó la identidad de marca, integró datos reales y dejó documentadas las dependencias externas. Se recomienda completar la configuración de Supabase, desplegar las Edge Functions y obtener las aprobaciones comerciales para habilitar pagos automáticos.'
  ]],
  ['12. Bibliografía', [
    'MDN Web Docs. Referencias de HTML, CSS, JavaScript, Web Speech API y WebGL. https://developer.mozilla.org',
    'three.js Documentation. GLTFLoader, MeshStandardMaterial y WebGLRenderer. https://threejs.org/docs',
    'Supabase Documentation. PostgreSQL, Auth, Storage, Edge Functions y Row Level Security. https://supabase.com/docs',
    'GitHub Docs. GitHub Pages y publicación de sitios estáticos. https://docs.github.com/pages',
    'W3C. Web Content Accessibility Guidelines (WCAG). https://www.w3.org/WAI/standards-guidelines/wcag/',
    'Repositorio GALAX PC REPAIR. README y documentación técnica interna (docs/). https://github.com/GalanESPACIAL/GALAX-PC-REPAIR'
  ]],
  ['13. Anexos', [
    'Anexo A — URL de verificación: https://galanespacial.github.io/GALAX-PC-REPAIR/docs/galax_preview.html',
    'Anexo B — Estructura de datos: catalog.json contiene meta, categories, brands, products, services, showcase y gallery; los productos incluyen code, name, brand, category, price, stock, specs e image.',
    'Anexo C — Verificación funcional: apertura del chat, búsquedas, accesos rápidos, favoritos, comentarios, galería, video, imágenes, voz y cierre sin errores de consola.',
    'Anexo D — Control de misiones: docs/MASTER_PROGRESS.md registra 30 fases y 300 misiones con estados PENDIENTE, EN PROGRESO, COMPLETADA, BLOQUEADA y VERIFICADA.',
    'Anexo E — Dependencias pendientes: Supabase URL y anon key, credenciales Culqi, aprobación de Yape/Plin, token de Gemma y servicio de visión; ninguna se encuentra expuesta en el frontend.'
  ]]
];
let first = true;
content.forEach(([sectionTitle, lines]) => {
  parts.push(p(sectionTitle, { size: 28, bold: true, align: 'left', firstLine: 0, space: 220, pageBreak: first }));
  first = false;
  lines.forEach((line) => {
    const isEnum = /^\d+\.\s/.test(line);
    const isLabel = line.endsWith(':');
    const isBiblio = sectionTitle.startsWith('12.');
    parts.push(p(line, { size: 24, firstLine: isEnum || isLabel ? 0 : 709, hanging: isBiblio && !isEnum && !isLabel, space: 120, italic: isLabel }));
  });
});

/* ================= Ensamblar ================= */
const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  tpl.slice(0, tpl.indexOf('<w:body>') + 8) + parts.join('') + sectPr + '</w:body></w:document>';

const footerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';

const src = 'C:/Users/Supremo-Pride/AppData/Local/Temp/opencode/docxtpl';
const outDir = path.join(process.cwd(), 'docs', 'word');
fs.mkdirSync(outDir, { recursive: true });
const files = [];
function walk(dir, rel = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name), r = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isDirectory()) walk(full, r); else files.push({ name: r, data: fs.readFileSync(full) });
  }
}
walk(src);
for (const f of files) {
  if (f.name === 'word/document.xml') f.data = Buffer.from(documentXml, 'utf8');
  if (f.name === 'word/_rels/document.xml.rels') {
    f.data = Buffer.from(String(f.data).replace('</Relationships>', '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'), 'utf8');
  }
  if (f.name === '[Content_Types].xml') {
    f.data = Buffer.from(String(f.data).replace('</Types>', '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'), 'utf8');
  }
}
files.push({ name: 'word/footer1.xml', data: Buffer.from(footerXml, 'utf8') });
const dest = path.join(outDir, 'PROYECTO_GALAX_PC_REPAIR_PEDRO_ALDAIR_ARRIASPLATA.docx');
fs.writeFileSync(dest, makeZip(files));
console.log('OK', dest, Math.round(fs.statSync(dest).size / 1024) + ' KB', 'paragraphs', parts.length);
