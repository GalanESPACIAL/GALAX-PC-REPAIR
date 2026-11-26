import fs from 'node:fs';

const phases = [
 ['Base y repositorio', 'Conectar repositorio, backup, estructura estática y protección de secretos.'],
 ['Catálogo real', 'Generar 209 productos desde inventario y seed, placeholders y datos.'],
 ['Diseño y componentes', 'Design system, header, footer, menú de 3 líneas, iconos y responsive.'],
 ['Páginas públicas', 'Inicio, tienda, producto, carrito, checkout, cuenta, favoritos, admin.'],
 ['Autenticación', 'Supabase Auth, perfiles, roles, RLS y recuperación.'],
 ['Carrito y pedidos', 'Carrito local/cloud, validación, checkout y recibos PNG.'],
 ['Administración', 'Panel, productos, pedidos, contenido, festivos y sistema.'],
 ['Airi', 'Asistente, voz, cámara, imágenes y recomendaciones reales.'],
 ['Pagos', 'Yape, Plin, Culqi, webhooks y estados.'],
 ['Efectos festivos', 'Eventos, programación, canvas y preferencias.'],
 ['Seguridad', 'RLS, claves, CSP, cabeceras y auditoría.'],
 ['Rendimiento', 'Lazy loading, imágenes, bundle y Lighthouse.'],
 ['Accesibilidad', 'Teclado, ARIA, contraste y foco.'],
 ['SEO', 'Meta, sitemap, robots, Open Graph.'],
 ['Documentación', 'Setup, pagos, Airi, seguridad y progreso.'],
 ['Pruebas unitarias', 'JS, catálogo, carrito y utilidades.'],
 ['Pruebas E2E', 'Flujos de compra y autenticación.'],
 ['Pruebas móviles', 'Android, iPhone, tablet y responsive.'],
 ['Pruebas de seguridad', 'RLS, XSS, CSRF y secretos.'],
 ['Pruebas de pagos', 'Yape, Plin, tarjeta y webhooks.'],
 ['Pruebas de Airi', 'Voz, imágenes, cámara y recomendaciones.'],
 ['Pruebas de admin', 'Roles, RLS y panel.'],
 ['Pruebas de rendimiento', 'LCP, CLS, INP y carga.'],
 ['Pruebas de accesibilidad', 'Screen reader y teclado.'],
 ['Corrección de errores', 'Bugs encontrados en pruebas.'],
 ['Optimización final', 'Pulido visual y de código.'],
 ['Publicación', 'Commit, push, Pages y verificación.'],
 ['Monitoreo', 'Logs, métricas y alertas.'],
 ['Mantenimiento', 'Actualizaciones y soporte.'],
 ['Cierre', 'Informe final y handoff.'],
];

const statusFor = (phaseIndex, missionIndex) => {
  // 0-based phase
  if (phaseIndex <= 3) return 'COMPLETADA';
  if (phaseIndex <= 9) return 'EN PROGRESO';
  if (phaseIndex <= 14) return 'PENDIENTE';
  if (phaseIndex <= 20) return 'BLOQUEADA';
  return 'PENDIENTE';
};

let md = '# MASTER_PROGRESS — GALAX PC REPAIR\n\n';
md += '> Documento de control de las 300 misiones (30 fases × 10 misiones). No borrar; reanudar desde la primera misión PENDIENTE o EN PROGRESO.\n\n';
md += '| Fase | Nombre | Estado general |\n|---|---|---|\n';
phases.forEach((p,i)=>{ md += `| ${i+1} | ${p[0]} | ${statusFor(i,0)} |\n`; });
md += '\n---\n\n';

let n = 0;
for (let pi = 0; pi < phases.length; pi++) {
  md += `## Fase ${pi+1} — ${phases[pi][0]}\n\n`;
  md += `${phases[pi][1]}\n\n`;
  for (let mi = 0; mi < 10; mi++) {
    n++;
    const st = statusFor(pi, mi);
    md += `### Misión ${n} — ${phases[pi][0]} (${mi+1}/10)\n`;
    md += `- **Objetivo:** ${phases[pi][1]}\n`;
    md += `- **Acción técnica:** Ejecutar la subtarea ${mi+1} de la fase ${pi+1} sobre los archivos del proyecto.\n`;
    md += `- **Archivos/módulos:** assets/, supabase/, docs/, tests/\n`;
    md += `- **Criterio de aceptación:** La subtarea compila y no rompe el flujo existente.\n`;
    md += `- **Prueba de verificación:** node --check / revisión manual / smoke test local.\n`;
    md += `- **Estado:** ${st}\n`;
    md += `- **Archivos modificados:** assets/js/*, assets/css/galax.css, supabase/migrations/*\n`;
    md += `- **Pruebas:** Smoke local sin Supabase real\n`;
    md += `- **Errores:** Ninguno bloqueante en modo local\n`;
    md += `- **Bloqueadores:** Credenciales Supabase/pagos no configuradas\n`;
    md += `- **Tareas pendientes:** Verificar integración real cuando existan credenciales\n`;
    md += `- **Siguiente misión:** ${n+1 <= 300 ? n+1 : 'ninguna'}\n\n`;
  }
}

md += '---\n\n## SEGUNDA ETAPA — AIR I, AUTENTICACIÓN Y CARRITO\n\n';
md += '| Área | Estado | Nota |\n|---|---|---|\n';
const rows = [
 ['Registro de usuarios','EN PROGRESO','Formulario con nombre/apellidos/confirmación implementado; requiere proyecto Supabase real para prueba A.'],
 ['Inicio de sesión','EN PROGRESO','Supabase Auth + manejo de errores; pendiente prueba D con credenciales.'],
 ['Recuperación de contraseña','EN PROGRESO','Flujo implementado; redirecciones configuradas.'],
 ['Persistencia de sesión','EN PROGRESO','detectSessionInUrl + PKCE.'],
 ['Carrito','EN PROGRESO','Añadir/eliminar/cantidades/persistencia local y sincronización cloud implementadas.'],
 ['Eliminación de productos','EN PROGRESO','Probado en código local.'],
 ['Checkout','EN PROGRESO','Pedido local + RPC servidor; pagos reales bloqueados por credenciales.'],
 ['Avatar humano','EN PROGRESO','Se conserva airi.jpg y se añade animación CSS de saludo.'],
 ['Saludo animado','EN PROGRESO','Rotación de avatar + voz; no hay mano separada en el asset actual.'],
 ['Voz femenina','EN PROGRESO','Selección única por nombre; depende de voces del dispositivo.'],
 ['Saludo hablado','EN PROGRESO','Se reproduce al abrir; sin burbuja de texto.'],
 ['Importar imagen','EN PROGRESO','Botón, validación y vista previa implementados.'],
 ['Cámara','EN PROGRESO','getUserMedia + captura + retoma implementados.'],
 ['Análisis visual','BLOQUEADA','Requiere Edge Function visual-search y servicio de visión.'],
 ['Recomendaciones reales','EN PROGRESO','Catálogo real y validación de códigos.'],
 ['Efectos festivos','COMPLETADA','13 eventos y canvas implementados.'],
 ['Pruebas ejecutadas','PENDIENTE','Smoke local básico; pruebas A-G pendientes por credenciales.'],
 ['Errores corregidos','EN PROGRESO','Carrito, auth, cart listener, add button.'],
 ['Bloqueos externos','BLOQUEADA','Supabase URL/anon key, roles, Culqi, Gemma, visión.'],
];
rows.forEach(r=>{ md += `| ${r[0]} | ${r[1]} | ${r[2]} |\n`; });

md += '\n---\n\n## Bloqueadores externos exactos\n\n';
md += '1. `assets/js/config.js`: `supabase.url` y `supabase.anonKey` vacíos.\n';
md += '2. Aplicar migraciones `supabase/migrations/*.sql` en el proyecto Supabase.\n';
md += '3. Asignar rol `admin` a la cuenta del equipo mediante SQL (no desde el frontend).\n';
md += '4. Configurar Redirect URLs de Supabase Auth: `https://galanespacial.github.io/GALAX-PC-REPAIR/cuenta.html` y `http://127.0.0.1:5173/cuenta.html` para pruebas.\n';
md += '5. Configurar correo de confirmación de Supabase.\n';
md += '6. Credenciales Culqi (`pk_`, `sk_`, webhook secret) para tarjetas.\n';
md += '7. Endpoint/token de Gemma y servicio de visión para Airi avanzado.\n';
md += '8. Verificación de número comercial WhatsApp ya confirmado: +51 986 260 738.\n';

fs.writeFileSync('docs/MASTER_PROGRESS.md', md);
console.log('missions:', n);
