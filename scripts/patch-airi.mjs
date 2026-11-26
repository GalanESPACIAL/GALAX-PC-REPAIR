import fs from 'node:fs';
const p='assets/js/airi.js';
let s=fs.readFileSync(p,'utf8');
const old="    let html = String(text || '').split('\\n').map((line) => '<span>' + esc(line) + '</span>').join('<br>');";
const neu="    let html = '';\n    if (options && options.image) html += '<img src=\"' + options.image + '\" alt=\"Imagen adjunta por el usuario\" style=\"max-width:100%;border-radius:8px;margin-bottom:6px;display:block\">';\n    html += String(text || '').split('\\n').map((line) => '<span>' + esc(line) + '</span>').join('<br>');";
if(!s.includes(old)){ console.error('NOT FOUND'); process.exit(1);}
s=s.replace(old,neu);
fs.writeFileSync(p,s);
console.log('OK');
