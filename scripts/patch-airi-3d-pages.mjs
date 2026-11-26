import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const airiTag = '<script src="assets/js/airi.js" defer></script>';
const importMap = '<script type="importmap">\n{"imports":{"three":"./docs/vendor/three.module.js","three/addons/":"./docs/vendor/"}}\n</script>';
const moduleTag = '<script type="module" src="./assets/js/airi-3d.js"></script>';
let changed = 0;

for (const file of files) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(airiTag) || s.includes('airi-3d.js')) continue;
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const mapLines = importMap.split('\n').join(eol);
  if (s.includes('</head>')) {
    s = s.replace('</head>', mapLines + eol + '</head>');
  } else {
    console.error('Sin </head>: ' + file);
    continue;
  }
  s = s.replace(airiTag, airiTag + eol + moduleTag);
  fs.writeFileSync(p, s);
  changed++;
  console.log('patched ' + file);
}
console.log('TOTAL ' + changed);
