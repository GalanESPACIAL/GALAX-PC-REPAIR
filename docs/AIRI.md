# Airi — asistente de GALAX PC REPAIR

## Identidad visual
- El avatar de Airi es el cuerpo 3D del proyecto: `docs/Cuerpo_SANARA IA/sanara_listo.glb` (personaje Sanara, animación `Levitate_Idle`).
- Fallback obligatorio: si WebGL falla o el modelo no carga, se conserva el avatar existente `assets/img/optimized/airi.jpg`.
- El saludo inicial se anima con la rama de la mano real (`upperarm_l`, `lowerarm_l`, `hand_l`) + respiración; sin animación de mano "inventada".

## Chat
- Implementación: `docs/galax_preview.html` (preview con stage 3D + chat) y panel flotante de `assets/js/airi.js`.
- Stage 3D: canvas WebGL con luces de estudio, glow neón, `MeshStandardMaterial` con textura del modelo.
- Animación: cabeza (head/spine) con micro-oscilaciones, saludo por rama de mano, respiración; respuesta → saludo/nod.
- Renderizado solo cuando el panel está abierto (performance).

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
