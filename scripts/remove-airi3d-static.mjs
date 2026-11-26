import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const tag = '<script type="module" src="./assets/js/airi-3d.js"></script>';
let n = 0;
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(tag)) continue;
  s = s.replace(tag + '\n', '').replace(tag + '\r\n', '').replace(tag, '');
  fs.writeFileSync(p, s);
  n++;
}
console.log('removed from ' + n + ' pages');
