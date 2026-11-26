#!/usr/bin/env node
/**
 * GALAX PC REPAIR — constructor del catálogo estático.
 *
 * Fuentes reales (no se inventan productos, precios ni stock):
 *  - docs/inventario_categoria1.sql ............ 200 PCs/laptops con precio y stock
 *  - database/supabase/002_seed_postgres.sql ... categorías, 12 productos, servicios y configuración
 *  - assets/img/productos/* .................... fotos e ilustraciones existentes
 *
 * Genera:
 *  - assets/data/catalog.json
 *  - assets/js/catalog-data.js
 *  - assets/data/content.json
 *  - assets/data/festive.json
 *  - supabase/migrations/202611260002_catalog_seed.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, data) => {
  const full = path.join(root, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data, 'utf8');
};
const slugify = (s) => s
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/["']/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 150);

/* ------------------------------------------------------------------ */
/* 1. Inventario real de 200 equipos                                  */
/* ------------------------------------------------------------------ */
const inventorySql = read('docs/inventario_categoria1.sql');
const inventory = [];
const invRe = /VALUES \('([^']+)','([^']+)','((?:[^']|'')*)',(\d+),'([^']*)',([\d.]+),([\d.]+),(\d+),(\d+)\)/g;
let im;
while ((im = invRe.exec(inventorySql))) {
  inventory.push({
    code: im[1],
    type: im[2],
    name: im[3].replace(/''/g, "'"),
    catId: Number(im[4]),
    brand: im[5],
    purchase: Number(im[6]),
    price: Number(im[7]),
    stock: Number(im[8]),
    published: Number(im[9]) === 1
  });
}
if (inventory.length !== 200) throw new Error(`Inventario incompleto: ${inventory.length}/200`);

/* ------------------------------------------------------------------ */
/* 2. Categorías, productos y servicios del seed Supabase              */
/* ------------------------------------------------------------------ */
const seedSql = read('database/supabase/002_seed_postgres.sql');

const categories = [];
const catRe = /\((\d+),\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'([^']+)',\s*'([^']+)',\s*'(activo|inactivo)',\s*'[^']+',\s*'[^']+',\s*'([^']+)'\)/g;
let cm;
while ((cm = catRe.exec(seedSql))) {
  categories.push({
    id: Number(cm[1]),
    name: cm[2],
    description: cm[3].replace(/''/g, "'"),
    icon: cm[4],
    color: cm[5],
    status: cm[6],
    slug: cm[7]
  });
}
if (categories.length < 20) throw new Error(`Categorías incompletas: ${categories.length}`);

const seedProducts = [];
const prodBlock = seedSql.split('INSERT INTO public.productos')[1]?.split('ON CONFLICT')[0] || '';
const prodRe = /\((\d+),\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*([\d.]+),\s*([\d.]+),\s*(NULL|[\d.]+),\s*(\d+),\s*(\d+),\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*(\d+),\s*(\d+)/g;
let pm;
while ((pm = prodRe.exec(prodBlock))) {
  seedProducts.push({
    id: Number(pm[1]),
    code: pm[2],
    name: pm[3].replace(/''/g, "'"),
    description: pm[4].replace(/''/g, "'"),
    categoryId: Number(pm[5]),
    brand: pm[6],
    model: pm[7],
    slug: pm[8],
    image: pm[9],
    specs: pm[10] === 'NULL' ? null : pm[10].replace(/^'|'$/g, ''),
    warranty: pm[11] === 'NULL' ? null : pm[11].replace(/^'|'$/g, ''),
    purchase: Number(pm[12]),
    price: Number(pm[13]),
    offer: pm[14] === 'NULL' ? null : Number(pm[14]),
    stock: Number(pm[15]),
    stockMin: Number(pm[16]),
    status: pm[17],
    published: Number(pm[18]) === 1,
    type: pm[19],
    featured: Number(pm[20]) === 1,
    isNew: Number(pm[21]) === 1
  });
}
if (seedProducts.length !== 12) throw new Error(`Productos seed incompletos: ${seedProducts.length}`);

const services = [];
const srvBlock = seedSql.split('INSERT INTO public.servicios')[1]?.split('ON CONFLICT')[0] || '';
const srvRe = /\((\d+),\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'([^']+)',\s*(NULL|[\d.]+),\s*(NULL|'[^']*'),\s*(\d+),\s*(\d+)/g;
let sm;
while ((sm = srvRe.exec(srvBlock))) {
  services.push({
    id: Number(sm[1]),
    code: sm[2],
    name: sm[3].replace(/''/g, "'"),
    description: sm[4].replace(/''/g, "'"),
    icon: sm[5],
    from: sm[6] === 'NULL' ? null : Number(sm[6]),
    duration: sm[7] === 'NULL' ? null : sm[7].replace(/^'|'$/g, ''),
    active: Number(sm[8]) === 1,
    order: Number(sm[9])
  });
}
if (services.length !== 6) throw new Error(`Servicios incompletos: ${services.length}`);

const config = {};
const cfgRe = /\((\d+),\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;
let gm;
while ((gm = cfgRe.exec(seedSql))) config[gm[2]] = gm[3].replace(/''/g, "'");

/* ------------------------------------------------------------------ */
/* 3. Normalización y especificaciones                                */
/* ------------------------------------------------------------------ */
const COLOR_WORDS = /\b(black|white|silver|grey|gray|blue|red|green|gold|pink|purple|space|midnight|starlight|graphite|natural|arctic|storm|eclipse|mica|shadow|nightfall|dark ash|slate|moonlight|transparent|obsidian|titanium)\b/i;
const LAPTOP_HINTS = /(laptop|notebook|ultrabook|pavilion|ideapad|thinkpad|vivobook|zenbook|elitebook|probook|spectre|victus|omen|legion|aspire|nitro|predator|macbook|rog|tuf|katana|modern|stealth|swift|travelmate|expertbook|latitude|inspiron|xps|thinkbook|yoga|loq|raider|creator|summit|prestige|surface)/i;
const DESKTOP_HINTS = /(desktop|mini pc|tiny pc|aio|all-in-one|tower|mac mini|mac studio|mac pro|workstation|optiplex|thinkcentre|ideacentre|expertcenter|prodesk|elitedesk|infinite|mag infinite)/i;

function splitName(name) {
  const parts = name.split(/\s+[—–]\s+/);
  const model = (parts.shift() || name).trim();
  const rest = parts.join(' — ').trim();
  return { model, specText: rest };
}

function parseSpecs(specText) {
  const chunks = specText.split(/\s+\/\s+|,\s+/).map((x) => x.trim()).filter(Boolean);
  const specs = {};
  for (const chunk of chunks) {
    if (!specs.cpu && /(core i\d|ryzen|apple m\d|intel|amd|celeron|pentium|xeon|snapdragon)/i.test(chunk)) specs.cpu = chunk;
    else if (!specs.storage && /(ssd|hdd|emmc|nvme|storage)/i.test(chunk)) specs.storage = chunk;
    else if (!specs.gpu && /(rtx|gtx|radeon|rx\s?\d|intel iris|intel uhd|apple gpu|geforce|quadro|rtx a)/i.test(chunk)) specs.gpu = chunk;
    else if (!specs.ram && /\b\d+\s?GB\b/i.test(chunk) && (/(ram|ddr|lpddr|unified)/i.test(chunk) || /^\d+\s?GB$/i.test(chunk))) specs.ram = chunk;
    else if (!specs.screen && /(\d{2}(\.\d)?\s?["”]|fhd|qhd|uhd|4k|oled|wuxga|wqxga|retina|xdr)/i.test(chunk)) specs.screen = chunk;
    else if (!specs.color && COLOR_WORDS.test(chunk) && chunk.length < 40) specs.color = chunk;
  }
  return { specs, chunks };
}

const categoryByKey = {
  laptops: categories.find((c) => c.slug === 'laptops'),
  computadoras: categories.find((c) => c.slug === 'desktops'),
  monitores: categories.find((c) => c.slug === 'monitores'),
  perifericos: categories.find((c) => c.slug === 'perifericos'),
  componentes: categories.find((c) => c.slug === 'componentes'),
  redes: categories.find((c) => c.slug === 'redes'),
  accesorios: categories.find((c) => c.slug === 'accesorios')
};

const productImage = {
  photoLaptopHp: 'assets/img/productos/LAP-001.png',
  photoLaptopLenovo: 'assets/img/productos/LAP-002.png',
  genericLaptop: 'assets/img/placeholders/laptop.svg',
  genericDesktop: 'assets/img/placeholders/desktop.svg',
  genericMonitor: 'assets/img/placeholders/monitor.svg',
  genericPeripheral: 'assets/img/placeholders/peripherals.svg',
  genericComponent: 'assets/img/placeholders/components.svg',
  genericNetwork: 'assets/img/placeholders/network.svg',
  genericAccessory: 'assets/img/placeholders/accessories.svg'
};

const products = [];
const usedSlugs = new Set();

function addProduct(p) {
  let slug = p.slug || slugify(p.model || p.name);
  if (usedSlugs.has(slug)) slug = `${slug}-${String(p.code).toLowerCase()}`;
  usedSlugs.add(slug);
  products.push({
    ...p,
    slug,
    price: p.offer ?? p.price,
    compareAt: p.offer != null ? p.price : null,
    published: p.published !== false,
    available: p.stock > 0,
    stockLabel: p.stock === 0 ? 'Agotado' : p.stock <= 3 ? 'Últimas unidades' : 'Disponible',
    images: p.image ? [p.image] : [],
    video: p.video || null,
    search: [p.name, p.brand, p.model, p.code, p.description, p.categoryName, ...(p.specList || []).map((s) => s.value)].join(' ').toLowerCase()
  });
}

/* 200 equipos del inventario real */
for (const item of inventory) {
  const { model, specText } = splitName(item.name);
  const { specs, chunks } = parseSpecs(specText);
  const isDesktop = DESKTOP_HINTS.test(item.name) || (/^Apple/i.test(item.brand) && /(mac mini|mac studio|mac pro)/i.test(item.name));
  const category = isDesktop ? categoryByKey.computadoras : categoryByKey.laptops;
  let image = isDesktop ? productImage.genericDesktop : productImage.genericLaptop;
  let imageKind = 'referencial';
  if (item.code === 'PC-001') { image = productImage.photoLaptopHp; imageKind = 'foto'; }
  if (item.code === 'PC-041') { image = productImage.photoLaptopLenovo; imageKind = 'foto'; }
  const specList = chunks.map((value, index) => ({
    label: specs.cpu === value ? 'Procesador' : specs.ram === value ? 'Memoria' : specs.storage === value ? 'Almacenamiento' : specs.gpu === value ? 'Gráficos' : specs.screen === value ? 'Pantalla' : specs.color === value ? 'Color' : `Característica ${index + 1}`,
    value
  }));
  addProduct({
    id: 1000 + Number(item.code.replace(/\D/g, '')),
    code: item.code,
    name: item.name,
    model,
    brand: item.brand,
    category: isDesktop ? 'computadoras' : 'laptops',
    categoryName: isDesktop ? 'Computadoras' : 'Laptops',
    categoryId: category.id,
    price: item.price,
    purchase: item.purchase,
    stock: item.stock,
    stockMin: 5,
    description: specText,
    specText,
    specs,
    specList,
    image,
    imageKind,
    featured: ['PC-001', 'PC-006', 'PC-041', 'PC-136', 'PC-174', 'PC-197'].includes(item.code),
    isNew: false,
    source: 'inventario_categoria1.sql'
  });
}

/* 12 productos del seed (se excluyen los 3 portátiles genéricos duplicados) */
const skipSeedCodes = new Set(['LAP-001', 'LAP-002', 'LAP-003']);
for (const p of seedProducts) {
  if (skipSeedCodes.has(p.code)) continue;
  const cat = categories.find((c) => c.id === p.categoryId);
  const { specs, chunks } = parseSpecs(p.description);
  const specList = chunks.map((value, index) => ({ label: specs.cpu === value ? 'Procesador' : specs.ram === value ? 'Memoria' : specs.storage === value ? 'Almacenamiento' : specs.gpu === value ? 'Gráficos' : specs.screen === value ? 'Pantalla' : specs.color === value ? 'Color' : `Característica ${index + 1}`, value }));
  addProduct({
    id: p.id,
    code: p.code,
    name: p.name,
    model: p.model,
    brand: p.brand,
    category: cat.slug === 'desktops' ? 'computadoras' : cat.slug,
    categoryName: cat.slug === 'desktops' ? 'Computadoras' : cat.name,
    categoryId: p.categoryId,
    price: p.price,
    purchase: p.purchase,
    stock: p.stock,
    stockMin: p.stockMin,
    description: p.description,
    specText: p.description,
    specs,
    specList,
    image: p.image,
    imageKind: 'referencial',
    featured: p.featured,
    isNew: p.isNew,
    source: '002_seed_postgres.sql'
  });
}

/* Orden: destacados y equipos con foto primero, luego por categoría/precio */
products.sort((a, b) => {
  if (a.imageKind !== b.imageKind) return a.imageKind === 'foto' ? -1 : 1;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return b.price - a.price;
});

/* Categorías visibles para la tienda */
const mainCategoryMeta = [
  { slug: 'laptops', name: 'Laptops', icon: 'fa-laptop', color: '#22d3ee', blurb: 'Equipos portátiles para estudio, trabajo y gaming.' },
  { slug: 'computadoras', name: 'Computadoras', icon: 'fa-desktop', color: '#8b5cf6', blurb: 'Desktops, mini PCs y estaciones de trabajo.' },
  { slug: 'monitores', name: 'Monitores', icon: 'fa-display', color: '#38bdf8', blurb: 'Pantallas para productividad y juego.' },
  { slug: 'componentes', name: 'Componentes', icon: 'fa-microchip', color: '#f59e0b', blurb: 'Memorias, SSD y piezas para tu equipo.' },
  { slug: 'perifericos', name: 'Periféricos', icon: 'fa-keyboard', color: '#ec4899', blurb: 'Teclados, mouse y audio.' },
  { slug: 'redes', name: 'Redes', icon: 'fa-wifi', color: '#10b981', blurb: 'Conectividad para hogar y negocio.' },
  { slug: 'accesorios', name: 'Accesorios', icon: 'fa-headphones', color: '#f43f5e', blurb: 'Complementos para tu setup.' }
];
const storeCategories = mainCategoryMeta.map((c) => {
  const seedCat = categories.find((x) => (x.slug === 'desktops' ? 'computadoras' : x.slug) === c.slug);
  return {
    ...c,
    id: seedCat?.id ?? null,
    count: products.filter((p) => p.category === c.slug).length
  };
}).filter((c) => c.count > 0);

const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
  .map((brand) => ({ name: brand, count: products.filter((p) => p.brand === brand).length }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

const priceValues = products.map((p) => p.price).filter((n) => Number.isFinite(n));
const meta = {
  generatedAt: new Date().toISOString(),
  source: 'docs/inventario_categoria1.sql + database/supabase/002_seed_postgres.sql',
  productCount: products.length,
  inventoryCount: inventory.length,
  seedCount: seedProducts.length,
  currency: 'PEN',
  currencySymbol: 'S/',
  priceMin: Math.min(...priceValues),
  priceMax: Math.max(...priceValues)
};

/* Piezas reales que no son productos del catálogo: monitor con fotos y video */
const showcase = [
  {
    id: 'showcase-samsung-24',
    name: 'Monitor Samsung 24" Full HD 75Hz',
    brand: 'Samsung',
    description: 'Producto documentado en los recursos del proyecto. Las imágenes y el video son material real del catálogo; el precio y el stock se confirman por WhatsApp.',
    images: [
      'assets/img/store/monitor-samsung-24.jpg',
      'assets/img/productos/MON-002.jpg'
    ],
    video: 'docs/producto/Monitores/Monitor%20Samsung%2024%20Full%20HD%2075Hz/Monitor%20Samsung%2024%20Full%20HD_video.mp4',
    specs: ['24 pulgadas', 'Full HD 1920×1080', '75 Hz', 'Samsung']
  }
];

/* Imagen de galería del taller y video promocional existentes */
const gallery = [
  { type: 'image', src: 'assets/img/store/galax-store.jpg', alt: 'Interior de la tienda y taller GALAX PC REPAIR', caption: 'Tienda y taller GALAX PC REPAIR' },
  { type: 'video', src: 'docs/video%20de%20anuncio/video%20d_anuncio-01.mp4', poster: 'assets/img/store/promo-rtx.jpg', caption: 'Video promocional GALAX PC REPAIR' },
  { type: 'image', src: 'assets/img/store/promo-rtx.jpg', alt: 'Campaña visual de componentes de alto rendimiento', caption: 'Campaña visual de componentes' }
];

/* ------------------------------------------------------------------ */
/* 4. Contenido editable por defecto                                  */
/* ------------------------------------------------------------------ */
const content = {
  version: '2026.11.26',
  brand: {
    name: 'GALAX PC REPAIR',
    tagline: 'Tecnología que funciona. Servicio en el que confía.',
    description: 'Tienda de computadoras, laptops y componentes; reparación técnica, diagnóstico y asistencia con Airi.',
    phone: config.empresa_telefono || '+51 986 260 738',
    whatsapp: (config.whatsapp_numero || '+51 986 260 738').replace(/[^\d]/g, ''),
    whatsappDisplay: config.whatsapp_numero || '+51 986 260 738',
    whatsappGroup: 'https://chat.whatsapp.com/I7Syor85Jia6lfE6oIJ7tX',
    email: config.empresa_email || 'contacto@galaxpcrepair.com',
    location: 'Lima, Perú',
    hours: 'Atención online y coordinación de servicio técnico',
    github: 'https://github.com/GalanESPACIAL/GALAX-PC-REPAIR',
    siteUrl: 'https://galanespacial.github.io/GALAX-PC-REPAIR/',
    logo: 'assets/img/logo.jpeg'
  },
  home: {
    kicker: 'Venta · Reparación · Asistencia',
    title: 'Tecnología que',
    highlight: 'sí funciona',
    text: 'Equipos con stock real, componentes seleccionados y servicio técnico especializado. Airi te ayuda a elegir con datos del catálogo, sin inventar precios ni disponibilidad.',
    primaryText: 'Explorar catálogo',
    primaryUrl: 'tienda.html',
    secondaryText: 'Reparar mi equipo',
    secondaryUrl: 'servicios.html#solicitud',
    promoTitle: 'Equipos para trabajo, estudio y gaming',
    promoText: 'Catálogo con inventario real de GALAX PC REPAIR. Consulta stock y coordina tu compra por WhatsApp o desde tu cuenta.',
    aboutTitle: 'Un taller, una tienda y una comunidad tecnológica',
    aboutText: 'GALAX PC REPAIR reúne venta de equipos, componentes, reparación y soporte en un solo lugar. Este sitio conserva la identidad gamer del proyecto y ahora funciona sin depender de XAMPP: el catálogo puede operar con Supabase y la tienda se publica como sitio estático en GitHub Pages.',
    servicesTitle: 'Servicio técnico con seguimiento',
    servicesText: 'Diagnóstico, reparación, mantenimiento y configuración de redes. Cada servicio se coordina con el taller.'
  },
  about: {
    title: 'Sobre GALAX PC REPAIR',
    subtitle: 'Hardware, servicio técnico y una identidad propia',
    paragraphs: [
      'GALAX PC REPAIR nace como un proyecto de tecnología y servicio técnico: venta de computadoras, laptops y componentes, además de reparación, mantenimiento y soporte.',
      'La identidad visual del lobo y el circuito forma parte del proyecto original. Este rediseño conserva el logo, los colores, las fotografías y los videos existentes, y moderniza la experiencia de compra.',
      'La tienda está preparada para operar con Supabase (catálogo, cuentas, favoritos y pedidos) y publicarse en GitHub Pages sin necesidad de mantener una computadora encendida con XAMPP.'
    ],
    image: 'assets/img/store/galax-store.jpg'
  },
  payments: {
    methods: ['Yape', 'Plin', 'Transferencia bancaria', 'Tarjeta (Culqi, cuando esté habilitado)'],
    note: 'Los pagos con tarjeta se procesan mediante una pasarela oficial cuando las credenciales comerciales estén configuradas. GALAX PC REPAIR nunca solicita el número completo de tarjeta ni el CVV por chat.',
    yapePlinNote: 'Para Yape o Plin, el pedido queda pendiente hasta que el equipo confirme la transferencia. No se marca como pagado por presionar un botón.'
  },
  shipping: {
    note: 'Envíos coordinados a todo el Perú. En Lima, el costo de envío a domicilio configurado es S/ 12. Para otras regiones se cotiza según destino y courier.',
    pickup: 'Recojo coordinado en el taller (sin costo de envío).',
    time: 'El plazo se confirma al validar stock y destino.'
  },
  policies: {
    terms: 'El uso de esta tienda implica aceptar las condiciones comerciales de GALAX PC REPAIR. Los precios están expresados en soles peruanos (PEN) e incluyen IGV cuando corresponde. La disponibilidad se valida al confirmar el pedido. Las imágenes referenciales no sustituyen una verificación del producto.',
    privacy: 'Usamos los datos que proporcionas (nombre, contacto, dirección y datos del pedido) para gestionar la compra, la entrega y el soporte. No vendemos datos personales. El historial de Airi se guarda en tu dispositivo y puedes borrarlo desde Configuración. Cuando Supabase está conectado, las cuentas y pedidos se almacenan en la nube con políticas de acceso por usuario.',
    returns: 'Los cambios y devoluciones se evalúan según el estado del producto, la garantía del fabricante y la normativa peruana aplicable. Coordina cualquier caso por WhatsApp o desde tu cuenta con el número de pedido.',
    warranty: 'La garantía depende del fabricante y del producto. GALAX PC REPAIR brinda soporte para canalizar la garantía; no se promete una cobertura distinta a la ofrecida por el fabricante.',
    receipt: 'El recibo PNG es un comprobante comercial interno generado con los datos del pedido. No sustituye automáticamente una factura electrónica SUNAT.'
  },
  services: services
    .filter((s) => s.active)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      code: s.code,
      name: s.name,
      description: s.description,
      icon: s.icon,
      from: s.from,
      duration: s.duration,
      id: 'servicio-' + slugify(s.name)
    })),
  faq: [
    { q: '¿Los precios y el stock son reales?', a: 'El catálogo se construye con el inventario del proyecto (200 equipos con precio y stock) y los productos del seed de Supabase. No se generan precios ni stock ficticios. Si Supabase está conectado, la base de datos es la fuente de verdad.' },
    { q: '¿Cómo compro?', a: 'Agrega productos al carrito, completa tus datos y elige el método de pago. En modo local el pedido se registra en tu dispositivo y se confirma por WhatsApp. Con Supabase conectado, el pedido se guarda en la nube y queda pendiente hasta validar el pago.' },
    { q: '¿Puedo pagar con Yape o Plin?', a: 'Sí, se coordinan como pago pendiente de confirmación. La tienda no marca un pedido como pagado hasta que el equipo verifica la transferencia.' },
    { q: '¿Airi inventa productos?', a: 'No. Airi busca en el catálogo real y muestra solo productos existentes. Si no encuentra una coincidencia, lo dice y ofrece contactar al taller.' },
    { q: '¿Necesito XAMPP?', a: 'No para esta tienda estática. GitHub Pages sirve el frontend y Supabase cubre datos, cuentas y pedidos. El panel PHP heredado se conserva en el repositorio como referencia, pero la tienda nueva no depende de él.' }
  ]
};

/* ------------------------------------------------------------------ */
/* 5. Eventos festivos (zona horaria Perú)                            */
/* ------------------------------------------------------------------ */
const events = [
  {
    id: 'black-friday-2026', name: 'Black Friday', theme: 'blackfriday', effect: 'spark',
    start: '2026-11-23T00:00:00-05:00', end: '2026-11-30T23:59:59-05:00',
    message: 'Black Friday: revisa el catálogo y consulta disponibilidad real.',
    cta: { text: 'Ver catálogo', url: 'tienda.html' }, colors: ['#fbbf24', '#22d3ee', '#f472b6'], density: 55, priority: 100, enabled: true
  },
  {
    id: 'aniversario-galax-2026', name: 'Aniversario GALAX', theme: 'galax', effect: 'stars',
    start: '2026-11-21T00:00:00-05:00', end: '2026-11-30T23:59:59-05:00',
    message: 'Aniversario GALAX PC REPAIR: tecnología y servicio técnico.',
    cta: { text: 'Conocer la tienda', url: 'nosotros.html' }, colors: ['#22d3ee', '#8b5cf6', '#ffffff'], density: 45, priority: 90, enabled: true
  },
  {
    id: 'cyber-days-2026', name: 'Cyber Days', theme: 'cyber', effect: 'spark',
    start: '2026-12-01T00:00:00-05:00', end: '2026-12-05T23:59:59-05:00',
    message: 'Cyber Days: encuentra tu próximo equipo.',
    cta: { text: 'Explorar', url: 'tienda.html' }, colors: ['#22d3ee', '#38bdf8', '#a78bfa'], density: 50, priority: 80, enabled: true
  },
  {
    id: 'navidad-2026', name: 'Navidad', theme: 'christmas', effect: 'snow',
    start: '2026-12-01T00:00:00-05:00', end: '2026-12-26T23:59:59-05:00',
    message: 'Navidad tecnológica en GALAX PC REPAIR.',
    cta: { text: 'Ver regalos tech', url: 'tienda.html' }, colors: ['#f8fafc', '#22d3ee', '#ef4444'], density: 70, priority: 70, enabled: true
  },
  {
    id: 'ano-nuevo-2027', name: 'Año Nuevo', theme: 'newyear', effect: 'confetti',
    start: '2026-12-27T00:00:00-05:00', end: '2027-01-06T23:59:59-05:00',
    message: 'Nuevo año, nuevo setup. Bienvenido a GALAX PC REPAIR.',
    cta: { text: 'Empezar el año', url: 'tienda.html' }, colors: ['#fbbf24', '#22d3ee', '#f472b6'], density: 75, priority: 85, enabled: true
  },
  {
    id: 'san-valentin-2027', name: 'San Valentín', theme: 'valentine', effect: 'hearts',
    start: '2027-02-07T00:00:00-05:00', end: '2027-02-15T23:59:59-05:00',
    message: 'Un detalle tecnológico para quien te importa.',
    cta: { text: 'Ver ideas', url: 'tienda.html' }, colors: ['#fb7185', '#f472b6', '#fda4af'], density: 45, priority: 50, enabled: true
  },
  {
    id: 'carnaval-2027', name: 'Carnaval', theme: 'carnaval', effect: 'confetti',
    start: '2027-02-13T00:00:00-05:00', end: '2027-02-17T23:59:59-05:00',
    message: 'Carnaval: color y tecnología.',
    cta: { text: 'Ver catálogo', url: 'tienda.html' }, colors: ['#f59e0b', '#22d3ee', '#ec4899'], density: 55, priority: 45, enabled: true
  },
  {
    id: 'dia-madre-2027', name: 'Día de la Madre', theme: 'mother', effect: 'petals',
    start: '2027-05-01T00:00:00-05:00', end: '2027-05-10T23:59:59-05:00',
    message: 'Tecnología para mamá, con servicio de confianza.',
    cta: { text: 'Ver regalos', url: 'tienda.html' }, colors: ['#f9a8d4', '#f472b6', '#fde68a'], density: 40, priority: 50, enabled: true
  },
  {
    id: 'dia-padre-2027', name: 'Día del Padre', theme: 'father', effect: 'spark',
    start: '2027-06-10T00:00:00-05:00', end: '2027-06-21T23:59:59-05:00',
    message: 'Un setup a la altura de papá.',
    cta: { text: 'Ver equipos', url: 'tienda.html' }, colors: ['#38bdf8', '#22d3ee', '#ffffff'], density: 40, priority: 50, enabled: true
  },
  {
    id: 'fiestas-patrias-2027', name: 'Fiestas Patrias del Perú', theme: 'peru', effect: 'ribbons',
    start: '2027-07-20T00:00:00-05:00', end: '2027-07-29T23:59:59-05:00',
    message: 'Fiestas Patrias: orgullo peruano y tecnología.',
    cta: { text: 'Ver catálogo', url: 'tienda.html' }, colors: ['#ef4444', '#ffffff', '#dc2626'], density: 45, priority: 60, enabled: true
  },
  {
    id: 'halloween-2027', name: 'Halloween', theme: 'halloween', effect: 'embers',
    start: '2027-10-25T00:00:00-05:00', end: '2027-11-01T23:59:59-05:00',
    message: 'Halloween en GALAX PC REPAIR.',
    cta: { text: 'Entrar al catálogo', url: 'tienda.html' }, colors: ['#f97316', '#a855f7', '#22d3ee'], density: 45, priority: 60, enabled: true
  },
  {
    id: 'black-friday-2027', name: 'Black Friday', theme: 'blackfriday', effect: 'spark',
    start: '2027-11-22T00:00:00-05:00', end: '2027-11-29T23:59:59-05:00',
    message: 'Black Friday: ofertas y stock por confirmar.',
    cta: { text: 'Ver catálogo', url: 'tienda.html' }, colors: ['#fbbf24', '#22d3ee', '#f472b6'], density: 55, priority: 100, enabled: true
  },
  {
    id: 'navidad-2027', name: 'Navidad', theme: 'christmas', effect: 'snow',
    start: '2027-12-01T00:00:00-05:00', end: '2027-12-26T23:59:59-05:00',
    message: 'Navidad tecnológica en GALAX PC REPAIR.',
    cta: { text: 'Ver regalos tech', url: 'tienda.html' }, colors: ['#f8fafc', '#22d3ee', '#ef4444'], density: 70, priority: 70, enabled: true
  }
];

/* ------------------------------------------------------------------ */
/* 6. Escritura de artefactos                                          */
/* ------------------------------------------------------------------ */
const catalog = {
  meta,
  categories: storeCategories,
  brands,
  products,
  services: content.services,
  showcase,
  gallery,
  sourceCategories: categories,
  config: {
    whatsapp: content.brand.whatsapp,
    whatsappDisplay: content.brand.whatsappDisplay,
    email: content.brand.email,
    shippingCost: Number(config.envio_costo || 12),
    igv: Number(config.igv_porcentaje || 18),
    currency: 'PEN'
  }
};

write('assets/data/catalog.json', JSON.stringify(catalog, null, 2));
write('assets/js/catalog-data.js', `/* Generado por scripts/build-catalog.mjs — no editar a mano. */\nwindow.GALAX_CATALOG = ${JSON.stringify(catalog)};\n`);
write('assets/data/content.json', JSON.stringify(content, null, 2));
write('assets/data/festive.json', JSON.stringify({ timezone: 'America/Lima', events }, null, 2));

/* SQL de catálogo idempotente */
const esc = (v) => String(v ?? '').replace(/'/g, "''");
const catIdFor = (slug) => categoryByKey[slug]?.id ?? 5;
const values = products.map((p) => {
  const specsJson = JSON.stringify(p.specs && Object.keys(p.specs).length ? p.specs : { 'Especificaciones': p.specText || p.description || '' });
  return `    ('${esc(p.code)}', '${esc(p.name)}', '${esc(p.description)}', ${p.categoryId || catIdFor(p.category)}, '${esc(p.brand)}', '${esc(p.model).slice(0, 80)}', '${esc(p.slug)}', '${esc(p.image)}', ${p.purchase || 0}, ${p.price}, ${p.stock}, ${p.stockMin || 5}, 'activo', ${p.published ? 1 : 0}, 'producto', ${p.featured ? 1 : 0}, ${p.isNew ? 1 : 0}, '${esc(specsJson)}')`;
});

const sql = `-- =====================================================================
-- GALAX PC REPAIR — catálogo real para Supabase (generado)
-- ---------------------------------------------------------------------
-- Fuente: docs/inventario_categoria1.sql (200 equipos con precio/stock)
--         + database/supabase/002_seed_postgres.sql (12 productos/servicios)
-- Generado: ${new Date().toISOString()}
-- Idempotente: ON CONFLICT (codigo) DO NOTHING. No borra datos.
-- Ejecutar después de 001_schema_postgres.sql y 002_seed_postgres.sql.
-- =====================================================================

-- Los 3 portátiles genéricos del seed se despublican para no duplicar
-- los modelos reales del inventario. NO se eliminan.
UPDATE public.productos
   SET publicado = 0
 WHERE codigo IN ('LAP-001', 'LAP-002', 'LAP-003');

-- Evita duplicados exactos por nombre/modelo en catálogos ya existentes.
INSERT INTO public.productos
    (codigo, nombre, descripcion, categoria_id, marca, modelo, slug, imagen,
     precio_compra, precio_venta, stock, stock_minimo, estado, publicado,
     tipo, destacado, es_nuevo, especificaciones)
VALUES
${values.join(',\n')}
ON CONFLICT (codigo) DO NOTHING;

-- Verificación esperada: 209 productos publicados (200 inventario + 9 seed).
SELECT count(*) AS productos_publicados FROM public.productos WHERE publicado = 1;

-- Índices de búsqueda (seguros de repetir).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm ON public.productos USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_productos_marca_trgm   ON public.productos USING gin (marca gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_productos_codigo       ON public.productos (codigo);
CREATE INDEX IF NOT EXISTS idx_productos_publicado    ON public.productos (publicado, estado, categoria_id);
`;
write('supabase/migrations/202611260002_catalog_seed.sql', sql);

console.log(JSON.stringify({
  products: products.length,
  categories: storeCategories.length,
  brands: brands.length,
  services: content.services.length,
  priceMin: meta.priceMin,
  priceMax: meta.priceMax,
  files: ['assets/data/catalog.json', 'assets/js/catalog-data.js', 'assets/data/content.json', 'assets/data/festive.json', 'supabase/migrations/202611260002_catalog_seed.sql']
}, null, 2));
