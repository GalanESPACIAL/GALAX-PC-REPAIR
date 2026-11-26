# Airi — asistente de GALAX PC REPAIR

Identidad:
- Se conserva el avatar existente `assets/img/optimized/airi.jpg`.
- No se creó un personaje nuevo.
- El saludo inicial es por voz y animación CSS; no se muestra burbuja de texto automática.

Voz:
- Se selecciona una sola voz en español cuando está disponible.
- La disponibilidad y calidad dependen del navegador/dispositivo.
- No se clona ninguna voz real.

Imágenes:
- Formatos admitidos: JPG, JPEG, PNG, WEBP.
- Tamaño máximo: 8 MB.
- Cámara mediante `getUserMedia` con opción de retomar.
- El análisis visual requiere `visual-search` desplegado; si no está disponible, Airi lo indica honestamente.
- Los productos recomendados se validan contra el catálogo real.

Limitaciones:
- La animación de saludo rota el avatar completo porque el asset actual no tiene una mano separada.
- Gemma y visión requieren credenciales/endpoints externos.
