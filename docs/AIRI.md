# Airi — asistente de GALAX PC REPAIR

## Identidad visual
- El avatar de Airi es el cuerpo 3D del proyecto: `docs/Cuerpo_SANARA IA/sanara_listo.glb` (personaje Sanara, animación `Levitate_Idle`), renderizado en vivo dentro del avatar circular del header del chat.
- Fallback obligatorio: si WebGL falla o el modelo no carga, se conserva el avatar existente `assets/img/optimized/airi.jpg`.
- El saludo inicial se anima con la rama de la mano real (`upperarm_l`, `lowerarm_l`, `hand_l`) + respiración; sin animación de mano "inventada".

## Chat
- Implementación en **todo el sitio**: panel flotante compacto (avatar 3D animado, "Airi · Asistente del catálogo real", volumen/borrar/cerrar, chip "Escuchar saludo de Airi", mensajes, prompts, input con imagen/cámara/mic/enviar y footnote) en `assets/js/airi.js` + `assets/css/galax.css`, y mismo diseño en `docs/galax_preview.html`.
- Todas las páginas incluyen el import map `three`; el módulo `assets/js/airi-3d.js` se carga **de forma diferida al abrir el chat** (no descarga three.js al entrar a la página).
- Encuadre del avatar: cámara fov 18, distancia 2.85 centrada en la cabeza para mostrar el rostro del personaje.
- Animación: cabeza (head/spine) con micro-oscilaciones, saludo por rama de mano, respiración; respuesta → saludo/nod; mira al usuario mientras escribe.
- Renderizado solo cuando el panel está abierto y la pestaña está visible (performance); respeta `prefers-reduced-motion`.

## Interacción y accesibilidad
- Panel con `role="dialog"` y `aria-labelledby` único (`airi-panel-title`), `aria-live` en mensajes, retorno de foco al cerrar y estados `:focus-visible`.
- **Autocompletado del catálogo real**: al escribir 2+ caracteres se muestran hasta 4 coincidencias con precio y código; al hacer clic se consulta ese código exacto. No inventa sugerencias.
- Tras una respuesta con 2+ productos se ofrece un chip **"Comparar estos modelos"** que usa códigos reales.
- Escape cierra sugerencias primero y luego el panel; clic fuera oculta las sugerencias.

## Voz
- Web Speech API: una sola voz en español (femenina por defecto, guardada en localStorage).
- Salida: `speechSynthesis`; entrada: `SpeechRecognition`/`webkitSpeechRecognition` con `es-PE`.
- Si no hay voz disponible, se ofrece alternativa honesta (escribir / botón de escucha).

## Imágenes y cámara
- Formatos: JPG/JPEG, PNG, WEBP. Máx. 8 MB. Validación por tipo y tamaño.
- Cámara: `getUserMedia({ video: { facingMode: 'environment' } })`, captura a canvas, retoma/usar.
- Análisis visual: solo con Edge Function `visual-search` desplegada; si no, respuesta honesta sin adivinar.

## Respuestas
- Solo catálogo real (`assets/data/catalog.json`, 209 productos) + Edge Function `ai-chat` (Gemma) cuando esté configurada.
- No se inventan precios, stock ni productos. Productos recomendados validan contra el catálogo.

## Limitaciones
- La IA conversacional (Gemma) y el análisis visual requieren credenciales/endpoints externos y despliegue de Edge Functions.
- El cuerpo 3D depende de WebGL del navegador; en dispositivos sin WebGL se usa el fallback.
- Los pagos y datos sensibles requieren backend Supabase + pasarelas oficiales (ver `docs/PAGOS.md`).
