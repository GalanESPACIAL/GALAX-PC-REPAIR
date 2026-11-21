# ai_service — inferencia local para Gemma 4 E4B IT

Servicio HTTP mínimo (solo biblioteca estándar de Python) para exponer el modelo
local `D:\GAlAX PC REPAIR\gemma-4-E4B-it` al backend PHP de GALAX PC REPAIR.

> **ESTADO DE VERIFICACIÓN: NO EJECUTADO EN ESTE ENTORNO.** Ver la sección
> final antes de dar nada por funcionando.

---

## 1. Arquitectura

```
PHP (define el system prompt del negocio)
        |
        | POST /chat  +  Authorization: Bearer <GEMMA_API_TOKEN>
        v
ai_service/server.py  (ThreadingHTTPServer, una sola instancia)
        |
        |-- SYSTEM_GUARD añadido en el servidor ( refuerzo no negociable )
        |-- apply_chat_template(..., enable_thinking=False)
        |-- modelo cargado UNA vez al arrancar (hilo "gemma-loader")
        |-- un único worker de inferencia -> sin recargas por mensaje
        |-- generate(..., max_new_tokens)
        |-- decode(..., skip_special_tokens=False)
        `-- parse_response(...)  (si no existe: limpieza regex, modo degradado)
```

Puntos de diseño:

- `server.py` **no importa** `transformers` ni `torch` al importarse: las
  dependencias se importan dentro de `load_model()`. Así `test_contract.py`
  puede ejecutarse con cualquier Python 3 sin descargar/cargar el modelo.
- El modelo se carga en un hilo de arranque. `/health` devuelve `loading`
  durante la carga y `ready`/`unavailable` después. `/chat` devuelve 503
  mientras no esté `ready`.
- La inferencia se serializa en un `ThreadPoolExecutor(max_workers=1)`: un solo
  modelo en memoria, sin recargas y sin ejecuciones concurrentes sobre el
  mismo objeto.
- El guard del servidor se fusiona con los mensajes `system` que envíe el PHP
  en un **único** bloque `system` inicial: el `chat_template.jinja` de Gemma 4
  trata solo `messages[0]` como turno system y el guard no se puede ignorar.
- Ninguna respuesta HTTP incluye rutas, claves, stacks ni texto de excepción.

### Archivos

| Archivo | Finalidad |
|---|---|
| `server.py` | Servicio HTTP, validación, autenticación, carga única e inferencia. |
| `requirements.txt` | Dependencias Python (sin el modelo). |
| `config.example.env` | Plantilla de variables de entorno, sin secretos reales. |
| `start_gemma.bat` | Arranque desde cualquier directorio; valida Python y la carpeta del modelo. |
| `test_contract.py` | Pruebas unitarias de validación sin cargar el modelo. |
| `README.md` | Este documento. |

---

## 2. Compatibilidad real

Basado en el `config.json` y el `README.md` locales del modelo, y en el
ejemplo oficial de Google:

- `model_type`: `gemma4`; `text_config.model_type`: `gemma4_text`.
- `architectures`: `Gemma4ForConditionalGeneration`.
- 42 capas de texto, vocab 262.144, `dtype` bfloat16,
  `transformers_version`: `5.5.0.dev0`.
- Incluye torres de visión y audio (multimodal). El servicio expone **solo
  texto**; no acepta imágenes ni audio por HTTP.
- API correcta (no sustituir por `AutoModelForCausalLM`):

```python
from transformers import AutoProcessor, AutoModelForMultimodalLM

processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID, dtype="auto", device_map="auto"
)
```

- El chat usa `processor.apply_chat_template(..., tokenize=True,
  return_dict=True, return_tensors="pt", add_generation_prompt=True,
  enable_thinking=False)` y `processor.parse_response(response,
  prefix=inputs["input_ids"])` para limpiar la salida, tal como indica el
  README oficial.
- Instalación mínima: `pip install -U transformers torch accelerate`.

**No se ofrece compatibilidad con llama.cpp ni con Ollama.** Este servicio no
convierte, cuantiza ni reempaqueta los safetensors; lee la carpeta tal cual.

---

## 3. Requisitos de memoria y hardware

- El archivo `model.safetensors` pesa **15.992.595.884 bytes (~16 GB)** en
  bfloat16. A eso hay que sumar overhead de PyTorch, caché KV, activaciones y
  las torres multimodal.
- Con **8,5 GB de RAM y sin GPU el modelo no cabe**: `device_map="auto"`
  terminará intentando descargar en CPU/disco o fallando por memoria. Se
  recomienda:
  - GPU con al menos ~16 GB de VRAM para bfloat16/float16, o
  - CPU con ~24–32 GB de RAM como mínimo y mucha paciencia, o
  - una variante cuantizada. **La cuantización NO está implementada en este
    servicio**: requeriría cambios de código y otra verificación.
- Si se usa CPU con `GEMMA_DTYPE=float32`, el consumo aproximado se duplica
  (~32 GB); `auto` respeta el bfloat16 del `config.json`.
- Se necesita un Python real (se recomienda 3.10+; confirmar el mínimo
  exacto de la versión de `transformers` 5.x que se instale).

---

## 4. Puesta en marcha y apagado

```bat
cd /d "D:\GAlAX PC REPAIR\ai_service"
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt

set GEMMA_MODEL_PATH=D:\GAlAX PC REPAIR\gemma-4-E4B-it
set GEMMA_API_TOKEN=un-token-largo-y-aleatorio
set GEMMA_HOST=127.0.0.1
set GEMMA_PORT=8501
set GEMMA_TIMEOUT=300

start_gemma.bat
```

`start_gemma.bat`:

- funciona desde cualquier directorio;
- usa `.venv\Scripts\python.exe`, `venv\Scripts\python.exe`, el venv de la
  raíz del proyecto o `python` del `PATH` (descarta el alias de Microsoft
  Store comprobando `python -c "import sys"`);
- comprueba que exista `config.json` en la carpeta del modelo;
- reenvía argumentos, p. ej. `start_gemma.bat --timeout 600`.

El primer arranque puede tardar varios minutos en cargar ~16 GB. Mientras
tanto, `/health` responde `status: "loading"`.

**Apagado:** `Ctrl+C` en la ventana, o `SIGTERM`. El servidor deja de aceptar
peticiones, cierra el socket y solicita el apagado del worker. Una generación
ya en curso puede terminar antes de que el proceso sala; el servicio no la
fuerza a abortar ( PyTorch no ofrece una cancelación segura para `generate`).

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `GEMMA_MODEL_PATH` | `<raíz del proyecto>\gemma-4-E4B-it` | Carpeta local del modelo. |
| `GEMMA_API_TOKEN` | *(vacío)* | Obligatorio para `/chat`. Vacío => 503 fail-closed. |
| `GEMMA_HOST` | `127.0.0.1` | Interfaz de escucha. |
| `GEMMA_PORT` | `8501` | Puerto. |
| `GEMMA_TIMEOUT` | `300` | Segundos máximos por petición (1..3600). |
| `GEMMA_MAX_NEW_TOKENS` | `512` | Valor por defecto del parámetro (64..1024). |
| `GEMMA_DTYPE` | `auto` | `auto`, `bfloat16`, `float16` o `float32`. |

`--host`, `--port`, `--timeout` y `--model-path` sobrescriben el entorno.
El archivo `config.example.env` es solo una plantilla: **no se carga
automáticamente**; exporta las variables en el entorno del proceso.

---

## 5. Endpoints

### `GET /health`

Sin autenticación. Nunca devuelve el token.

```json
{"status": "ready", "model": "gemma-4-E4B-it", "detail": "Modelo cargado y listo para responder."}
```

`status` puede ser `loading`, `ready` o `unavailable`. En `unavailable`,
`detail` es un mensaje genérico (por ejemplo, dependencias ausentes o memoria
insuficiente), sin rutas ni excepciones.

### `POST /chat`

Cabeceras obligatorias:

```
Authorization: Bearer <GEMMA_API_TOKEN>
Content-Type: application/json
```

Cuerpo:

```json
{
  "messages": [
    {"role": "system", "content": "Eres el asistente de GALAX PC REPAIR."},
    {"role": "user", "content": "Hola"}
  ],
  "max_new_tokens": 128
}
```

Respuesta correcta:

```json
{"ok": true, "reply": "Hola. ¿En qué puedo ayudarte?"}
```

Respuesta de error:

```json
{"ok": false, "error": "Mensaje seguro y genérico."}
```

Validaciones y límites:

| Regla | Valor |
|---|---|
| Tamaño máximo del body | 64 KB (`Content-Length` obligatorio) |
| Número de mensajes | 1..32 |
| Roles permitidos | `system`, `user`, `assistant` |
| Caracteres por mensaje | ≤ 12.000 |
| Caracteres totales | ≤ 48.000 |
| `max_new_tokens` | entero 64..1024 |
| Solicitudes en cola | ≤ 2; exceso => 504 |

Códigos: 200 OK, 400 validación/JSON, 401 token inválido, 411 sin
`Content-Length`, 413 body demasiado grande, 404 ruta desconocida, 405 método
no permitido, 503 sin token configurado / modelo cargando o no disponible,
504 timeout, 502 fallo de inferencia, 500 error interno genérico.

Solo se reenvían `role` y `content` al chat template: cualquier otro campo del
mensaje se descarta para no inyectar contenido multimodal inesperado.

---

## 6. Ejemplos

### curl (bash)

```bash
curl -s http://127.0.0.1:8501/health

curl -s -X POST http://127.0.0.1:8501/chat \
  -H "Authorization: Bearer $GEMMA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hola"}],"max_new_tokens":128}'
```

### PowerShell

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8501/health

$body = @{
    messages = @(@{ role = 'user'; content = 'Hola' })
    max_new_tokens = 128
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://127.0.0.1:8501/chat -Method Post `
  -Headers @{ Authorization = "Bearer $env:GEMMA_API_TOKEN" } `
  -ContentType 'application/json' -Body $body
```

### Pruebas de contrato (sin modelo)

```bat
cd /d "D:\GAlAX PC REPAIR\ai_service"
python -m unittest -v test_contract
```

---

## 7. Notas sobre `parse_response`

El README oficial usa `processor.parse_response(response,
prefix=inputs["input_ids"])`. El servicio:

1. llama a `parse_response` si existe en la versión instalada;
2. extrae el texto de cadena/diccionario/objeto devuelto;
3. si la función no existe, lanza excepción o devuelve algo sin texto, aplica
   una limpieza con regex de tokens especiales (`<bos>`, `<eos>`,
   `<end_of_turn>`, `<|...|>`, bloques `<think>...</think>`);
4. si tras la limpieza no queda texto, devuelve un error en vez de fingir
   éxito.

El uso de la ruta de degradación queda registrado en `stderr` con un aviso
genérico. No se expone al cliente como si el parser oficial hubiera funcionado.

---

## 8. ESTADO DE VERIFICACIÓN: NO EJECUTADO EN ESTE ENTORNO

**Este código NO se ha ejecutado ni verificado en el entorno donde se ha
escrito.** No se afirma que funcione hasta probarlo en la máquina objetivo.

Razones concretas:

1. No hay un intérprete de Python real instalado. `python` y `python3` son
   únicamente los alias de Microsoft Store (`WindowsApps\python.exe`), que
   redirigen a la tienda y no ejecutan código. Por tanto **no se pudo ejecutar
   `python -m py_compile` ni `python -m unittest`**.
2. El entorno tiene ~8,5 GB de RAM y ninguna GPU, mientras que el modelo ocupa
   ~16 GB solo en pesos. Aun con Python real, la carga no cabría aquí, así que
   **no se pudo probar una sola inferencia**.
3. No se descargó, copió ni movió ningún archivo del modelo.

Lo que sí se comprobó en este entorno: la existencia de la carpeta del modelo,
su `config.json` (arquitectura, 42 capas, vocab, dtype, versión de
transformers), su `generation_config.json` y el ejemplo oficial del README
local. El código se ha escrito siguiendo ese ejemplo, pero requiere verificación
en un equipo con Python real y memoria/GPU suficientes.

Checklist para verificar en el equipo objetivo:

- [ ] `python -m py_compile server.py test_contract.py`
- [ ] `python -m unittest -v test_contract`
- [ ] `pip install -r requirements.txt` con `transformers` 5.5.0.dev0
- [ ] `GET /health` pase de `loading` a `ready`
- [ ] `POST /chat` con token válido devuelva `ok: true`
- [ ] `POST /chat` sin token devuelva 503 y con token erróneo 401
- [ ] Medir memoria real y ajustar `GEMMA_DTYPE`/cuantización fuera de este ámbito

### Verificación del lado PHP (sí ejecutada)

Aunque el servicio Python no se pudo ejecutar, el consumidor PHP quedó probado:

- `GET /api/ai.php?health=1` → HTTP 200, 86 bytes, `ready: false`.
- `POST /api/ai.php` con CSRF válido y mensaje `laptop stock` → `ok: true`,
  `mode: busqueda_local`, `notice: El modelo local no está configurado en este servidor.`
- Sin token CSRF, la API rechaza la petición (HTTP 419).
- El token `GEMMA_API_TOKEN` no se envía al navegador; las respuestas de fallback
  se identifican como búsqueda local y nunca se presentan como salida de Gemma.
- El historial de chat se persiste en `ai_conversaciones`/`ai_mensajes` para
  usuarios autenticados, se depura según `chat_historial_dias` y se puede borrar
  desde `shop/portal.php?tab=perfil`. Los datos de prueba se eliminaron después.
