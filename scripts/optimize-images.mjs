#!/usr/bin/env node
/**
 * No hay dependencias externas de imágenes en el navegador; este script deja
 * copias optimizadas de los activos reales para no cargar JPG de 1.2 MB en móvil.
 * Usa `sharp` sólo si está disponible; de lo contrario conserva los originales.
 */
import fs from 'node:fs';
import path from 'node:path';

const out = 'assets/img/optimized';
fs.mkdirSync(out, { recursive: true });

const jobs = [
  ['assets/img/store/galax-store.jpg', 'store.jpg'],
  ['assets/img/store/promo-rtx.jpg', 'promo.jpg'],
  ['assets/img/store/monitor-samsung-24.jpg', 'monitor-samsung.jpg'],
  ['assets/img/airi-stage.png', 'airi.jpg'],
  ['assets/img/productos/LAP-001.png', 'laptop-hp.jpg'],
  ['assets/img/productos/LAP-002.png', 'laptop-lenovo.jpg']
];

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.log('sharp no está instalado: se conservan los originales y se omite la optimización.');
  process.exit(0);
}

for (const [source, name] of jobs) {
  if (!fs.existsSync(source)) continue;
  const dest = path.join(out, name);
  await sharp(source)
    .rotate()
    .resize({ width: name.startsWith('laptop') ? 1000 : 1600, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(dest);
  console.log(name, `${Math.round(fs.statSync(dest).size / 1024)} KB`);
}
