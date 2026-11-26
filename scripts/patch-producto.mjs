import fs from 'node:fs';
const p='assets/js/producto.js';
let s=fs.readFileSync(p,'utf8');
const old="    $('#detail-short').textContent = p.description || 'Producto del catálogo GALAX PC REPAIR. Revisa las especificaciones registradas y consulta cualquier detalle por WhatsApp.';";
const neu="    const shortNode = document.getElementById('detail-subtitle');\n    if (shortNode && !shortNode.textContent.trim()) shortNode.textContent = p.description || 'Producto del catálogo GALAX PC REPAIR. Revisa las especificaciones registradas y consulta cualquier detalle por WhatsApp.';";
if(!s.includes(old)){ console.error('NOT FOUND'); process.exit(1);}
s=s.replace(old,neu);
fs.writeFileSync(p,s);
console.log('OK');
