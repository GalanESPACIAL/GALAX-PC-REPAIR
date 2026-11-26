/* =====================================================================
   GALAX PC REPAIR — Airi, asistente del catálogo real.
   - Modo local: recuperación determinista sobre catalog.json (sin inventar).
   - Modo nube: Edge Function ai-chat (Gemma) cuando está configurada.
   - Voz: Web Speech API (STT/TTS) con mensajes honestos si no está disponible.
   - Cámara: vista previa local; análisis sólo si visual-search está desplegado.
   ===================================================================== */
(function () {
  'use strict';
  const HISTORY_KEY = 'galax_airi_history_v1';
  const VOICE_KEY = 'galax_airi_voice_v1';
  const MAX_HISTORY = 20;
  const state = {
    ready: false,
    open: false,
    busy: false,
    history: [],
    voiceOut: false,
    volume: 1,
    speaking: false,
    recognition: null,
    recording: false,
    image: null,
    cloudTried: false,
    cameraStream: null,
    cameraShot: null,
    greetingShown: false
  };
  let panel, fab, messagesEl, form, input, sendBtn, micBtn, imageInput, voiceBtn, imagePreview, cameraBtn, importBtn, cameraPanel, cameraVideo, cameraCanvas, cameraCapture, cameraRetake, cameraUse, cameraClose;

  const STOP = new Set(['de','la','el','los','las','un','una','unos','unas','que','con','para','por','en','y','o','mi','me','al','del','se','su','sus','es','son','como','cual','cuales','quiero','necesito','busco','buscar','recomienda','recomiendame','dame','ver','precio','precios','stock','tienen','tienes','hay','hola','buenas','buenos','dias','tardes','noches','gracias','porfa','porfavor','soles','s/','pen','presupuesto','hasta','menos','maximo','entre','mas','muy','pero','sin','sobre','este','esta','estos','estas','algo','equipo','equipos','producto','productos']);
  const LAPTOP_WORDS = /(laptop|portatil|notebook|ultrabook|pavilion|ideapad|thinkpad|vivobook|zenbook|elitebook|probook|spectre|victus|omen|legion|aspire|nitro|predator|macbook|rog|tuf|katana|modern|stealth|swift|travelmate|expertbook|latitude|inspiron|xps|thinkbook|yoga|loq|raider|creator|summit|prestige)/i;
  const DESKTOP_WORDS = /(desktop|computadora|pc de escritorio|torre|mini pc|workstation|optiplex|thinkcentre|ideacentre|expertcenter|prodesk|elitedesk|infinite|mac mini|mac studio|mac pro|gaming pc)/i;
  const GPU_WORDS = /(rtx|gtx|radeon|geforce|quadro|arc a)/i;
  const DESIGN_WORDS = /(diseno|diseño|edicion|edición|photoshop|illustrator|premiere|after effects|render|autocad|blender|arquitectura|video)/i;
  const GAMING_WORDS = /(gaming|gamer|jugar|juego|videojuego|fortnite|valorant|minecraft|league of legends|dota|steam)/i;
  const STUDY_WORDS = /(estudio|estudiar|ofimatica|ofimática|word|excel|powerpoint|clases|universidad|colegio|escuela|tarea)/i;
  const CODE_WORDS = /(programar|programacion|programación|desarrollo|codigo|código|python|javascript|java|web)/i;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function catalogProducts() {
    return (window.GALAX && GALAX.catalog && GALAX.catalog.products) || [];
  }
  function available() {
    return catalogProducts().filter((p) => p.published && p.stock > 0);
  }
  function money(v) { return window.GALAX ? GALAX.money(v) : 'S/ ' + v; }
  function esc(v) { return window.GALAX ? GALAX.esc(v) : String(v || ''); }
  function normalize(v) { return window.GALAX ? GALAX.normalizeText(v) : String(v || '').toLowerCase(); }
  function productImage(p) { return window.GALAX ? GALAX.productImage(p) : p.image; }
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const data = raw ? JSON.parse(raw) : [];
      state.history = Array.isArray(data) ? data.slice(-MAX_HISTORY) : [];
    } catch { state.history = []; }
    try { state.voiceOut = localStorage.getItem(VOICE_KEY) === '1'; } catch { state.voiceOut = false; }
  }
  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-MAX_HISTORY))); } catch {}
  }
  function addHistory(role, text, codes) {
    state.history.push({ role, text, codes: codes || [], at: Date.now() });
    state.history = state.history.slice(-MAX_HISTORY);
    saveHistory();
  }
  function budgetFrom(text) {
    const t = normalize(text);
    if (!/(s\/|soles|presupuesto|hasta|menos de|maximo|máximo|entre|por)\s*[s\/]?\s*\d/.test(t) && !/\d+\s*(soles|pen)/.test(t)) return {};
    const nums = (t.match(/\d[\d.,]{1,}/g) || []).map((n) => Number(n.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))).filter((n) => n >= 200 && n <= 100000);
    if (!nums.length) return {};
    if (/entre/.test(t) && nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
    const value = Math.min.apply(null, nums);
    if (/(desde|minimo|mínimo)/.test(t)) return { min: value };
    return { max: value };
  }
  function categoryFrom(text) {
    const t = normalize(text);
    if (/(monitor|pantalla|display)/.test(t)) return 'monitores';
    if (/(teclado|mouse|periferico|periférico|audifono|audífono|headset)/.test(t)) return 'perifericos';
    if (/(ssd|ram|memoria|procesador|tarjeta de video|gpu|componente|fuente|placa)/.test(t)) return 'componentes';
    if (/(router|wifi|red|switch|repetidor)/.test(t)) return 'redes';
    if (/(audifonos|audífonos|accesorio|cargador|funda|mochila|cable)/.test(t)) return 'accesorios';
    if (/(desktop|computadora|pc de escritorio|torre|mini pc|workstation)/.test(t)) return 'computadoras';
    if (LAPTOP_WORDS.test(t)) return 'laptops';
    return null;
  }
  function brandFrom(text) {
    const t = normalize(text);
    const brands = ((window.GALAX && GALAX.catalog && GALAX.catalog.brands) || []).map((b) => b.name).sort((a, b) => b.length - a.length);
    return brands.find((b) => t.includes(normalize(b))) || null;
  }
  function findProductByText(text) {
    const t = normalize(text);
    const codeMatch = t.match(/\b([a-z]{2,3}-\d{2,3})\b/i);
    if (codeMatch) {
      const found = catalogProducts().find((p) => normalize(p.code) === normalize(codeMatch[1]));
      if (found) return found;
    }
    const tokens = t.split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (!tokens.length) return null;
    let best = null, bestScore = 0;
    for (const p of catalogProducts()) {
      const hay = normalize([p.name, p.model, p.brand, p.code, p.description].join(' '));
      let score = 0;
      for (const token of tokens) if (hay.includes(token)) score += token.length >= 5 ? 3 : 1;
      if (normalize(p.model) && t.includes(normalize(p.model))) score += 12;
      if (normalize(p.code) && t.includes(normalize(p.code))) score += 20;
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return bestScore >= 4 ? best : null;
  }
  function scoreFor(p, opts) {
    let score = 0;
    const name = normalize([p.name, p.specs && Object.values(p.specs).join(' ')].join(' '));
    if (p.featured) score += 8;
    if (p.stock > 3) score += 5; else if (p.stock > 0) score += 1;
    if (p.imageKind === 'foto') score += 5;
    if (opts.use === 'gaming' && GPU_WORDS.test(name)) score += 40;
    if (opts.use === 'design' && (GPU_WORDS.test(name) || /oled|retina|32gb|64gb/i.test(name))) score += 30;
    if (opts.use === 'code') {
      const ram = Number((String((p.specs && p.specs.ram) || '').match(/\d+/) || [0])[0]);
      if (ram >= 16) score += 20;
      if (/ssd|nvme/i.test(name)) score += 8;
    }
    if (opts.use === 'study' && p.price < 3500) score += 18;
    if (opts.brand && normalize(p.brand) === normalize(opts.brand)) score += 35;
    if (opts.category && p.category === opts.category) score += 30;
    if (opts.max && p.price <= opts.max) score += 15;
    if (opts.max && p.price > opts.max * 1.25) score -= 30;
    if (opts.min && p.price < opts.min) score -= 20;
    return score;
  }
  function recommend(opts) {
    opts = opts || {};
    let list = available();
    if (opts.category) list = list.filter((p) => p.category === opts.category);
    if (opts.brand) list = list.filter((p) => normalize(p.brand) === normalize(opts.brand));
    if (opts.max) list = list.filter((p) => p.price <= opts.max);
    if (opts.min) list = list.filter((p) => p.price >= opts.min);
    if (opts.codes) list = list.filter((p) => opts.codes.includes(p.code));
    if (opts.use === 'gaming') {
      const gpu = list.filter((p) => GPU_WORDS.test([p.name, p.specs && Object.values(p.specs).join(' ')].join(' ')));
      if (gpu.length) list = gpu;
    }
    list = list.sort((a, b) => scoreFor(b, opts) - scoreFor(a, opts) || a.price - b.price);
    return list.slice(0, opts.limit || 3);
  }
  function productSummary(p) {
    return p.name.split(' — ')[0] + ' — ' + money(p.price) + ' · ' + (p.stock > 0 ? 'stock ' + p.stock : 'agotado');
  }

  /* ------------------------------------------------------------------ */
  /* Respuestas locales                                                 */
  /* ------------------------------------------------------------------ */
  function localAnswer(raw) {
    const text = String(raw || '').trim();
    const t = normalize(text);
    if (!text) return { text: 'Escribe una consulta o usa una sugerencia. También puedes dictarla con el micrófono.' };
    if (/^(hola|buenas|hey|holaa|que tal|qué tal)/.test(t) && text.length < 45) {
      return { text: 'Hola, soy Airi. Puedo ayudarte a encontrar un equipo del catálogo real, revisar stock, comparar modelos o explicarte cómo comprar. ¿Qué necesitas?' };
    }
    if (/(quien eres|quién eres|que haces|qué haces|tu nombre|airi)/.test(t) && text.length < 80) {
      return { text: 'Soy Airi, la asistente de GALAX PC REPAIR. Trabajo con el catálogo real de la tienda: no invento productos, precios ni stock. Puedo recomendarte equipos, comparar fichas y explicarte el proceso de compra. Si no encuentro un dato, te derivo con el equipo por WhatsApp.' };
    }
    if (/(pago|pagar|yape|plin|tarjeta|culqi|transferencia|visa|mastercard)/.test(t) && !/(precio|stock|equipo|laptop)/.test(t)) {
      return { text: 'Puedes coordinar Yape, Plin o transferencia; el pedido queda pendiente hasta que el equipo confirme la transferencia. Los pagos con tarjeta se procesan con una pasarela oficial cuando las credenciales comerciales estén configuradas. GALAX nunca te pedirá el número completo de tarjeta ni el CVV por chat. En el checkout verás qué métodos están habilitados en ese momento.' };
    }
    if (/(envio|envío|delivery|llega|provincia|lima|recojo)/.test(t) && !/(precio|stock|equipo|laptop)/.test(t)) {
      return { text: 'En Lima, el envío a domicilio configurado es S/ 12; el recojo coordinado en el taller no tiene costo de envío. Para otras regiones se cotiza según destino y courier. El plazo se confirma al validar stock y dirección. Coordinamos los detalles por WhatsApp.' };
    }
    if (/(recibo|boleta|factura|sunat|comprobante)/.test(t)) {
      return { text: 'Al confirmar un pedido puedes descargar un recibo PNG con los datos reales de la orden. Es un comprobante comercial interno: no sustituye automáticamente una factura electrónica SUNAT. Si necesitas un documento tributario, coordínalo con el equipo por WhatsApp.' };
    }
    if (/(garantia|garantía|devolucion|devolución|cambio)/.test(t) && !/(precio|stock|equipo|laptop)/.test(t)) {
      return { text: 'La garantía depende del fabricante y del producto; GALAX brinda soporte para canalizar el caso, sin prometer una cobertura distinta a la del fabricante. Los cambios y devoluciones se evalúan según el estado del producto y la normativa peruana aplicable. Escríbenos con tu código de pedido para revisarlo.' };
    }
    if (/(reparar|reparacion|reparación|tecnico|técnico|microsoldadura|mantenimiento|formateo|diagnostico|diagnóstico|no enciende|pantalla)/.test(t) && !categoryFrom(t)) {
      return { text: 'GALAX ofrece reparación de PC y laptops, microsoldadura, formateo e instalación, mantenimiento preventivo, redes y diagnóstico electrónico. Los servicios se cotizan según la evaluación del equipo; no hay precio automático en la web. Puedes solicitar diagnóstico desde Servicios o escribir por WhatsApp.', links: [{ text: 'Ver servicios técnicos', url: 'servicios.html' }, { text: 'Solicitar diagnóstico', url: 'servicios.html#solicitud' }] };
    }
    if (/(whatsapp|contacto|telefono|teléfono|llamar|ubicacion|ubicación|direccion|dirección|horario)/.test(t) && !/(precio|stock|equipo|laptop)/.test(t)) {
      return { text: 'La atención principal es por WhatsApp al ' + ((GALAX.content.brand && GALAX.content.brand.whatsappDisplay) || '+51 986 260 738') + '. Coordinamos compras, recojo y servicio técnico por ese canal. La tienda atiende online y el taller está en Lima, Perú; no publicamos una dirección que no esté confirmada.', links: [{ text: 'Abrir contacto', url: 'contacto.html' }] };
    }
    if (/(xampp|php|mysql|base de datos|supabase|github pages)/.test(t) && !/(precio|stock|equipo|laptop)/.test(t)) {
      return { text: 'La tienda nueva es un frontend estático publicado en GitHub Pages. El catálogo, las cuentas y los pedidos pueden operar con Supabase; XAMPP ya no es necesario para el visitante. Mientras las credenciales de Supabase no estén configuradas, la navegación y el catálogo usan datos locales reales del proyecto, y los pedidos se guardan en este dispositivo para coordinar por WhatsApp.' };
    }
    if (/(camara|cámara|foto|imagen|reconocer|reconocimiento)/.test(t)) {
      return { text: 'Puedes adjuntar una foto desde el botón de cámara. Si el servicio de búsqueda visual está desplegado, Airi analizará la imagen y solo mostrará coincidencias del catálogo real, indicando su nivel de certeza. En modo local no puedo interpretar el contenido: sería deshonesto afirmar lo contrario. También puedes enviar la foto por WhatsApp para que la revise una persona.' };
    }
    if (/(voz|microfono|micrófono|hablar|escuchar)/.test(t)) {
      return { text: 'Puedes usar el micrófono para dictar tu consulta y el botón de altavoz de cada respuesta para escucharla. La voz depende del navegador (funciona mejor en Chrome/Edge). Si no está disponible, Airi te lo indicará y podrás escribir.' };
    }
    if (/(compara|comparar|versus| vs |diferencia)/.test(t)) {
      const codes = Array.from(new Set((t.match(/\b[a-z]{2,3}-\d{2,3}\b/gi) || []).map((x) => x.toUpperCase())));
      const products = codes.map((c) => catalogProducts().find((p) => p.code === c)).filter(Boolean);
      if (products.length >= 2) {
        return { text: products.map((p) => productSummary(p) + ' · ' + (p.specs && Object.values(p.specs).slice(0, 3).join(' / '))).join('\n') + '\n\nDiferencia clave: revisa procesador, memoria, almacenamiento y GPU en cada ficha. No puedo prometer rendimiento en un programa específico sin conocer sus requisitos; el stock se confirma al crear el pedido.', products: products.map((p) => p.code) };
      }
      return { text: 'Para comparar necesito los códigos o modelos exactos, por ejemplo “compara PC-001 y PC-041”. Puedes buscar ambos en el catálogo y usar la ficha de cada equipo.' };
    }
    // Producto específico por código/modelo
    const exact = findProductByText(text);
    if (exact && /(precio|cuanto|cuánto|stock|disponible|tienen|tienes|info|ficha|detalle)/.test(t)) {
      return {
        text: productSummary(exact) + '. ' + (exact.stock > 0 ? 'El stock mostrado proviene del catálogo; se valida otra vez al crear el pedido.' : 'Ahora figura agotado; te recomiendo consultar por WhatsApp antes de desplazarte.') + '\n\n' + (exact.specList || []).slice(0, 5).map((s) => s.label + ': ' + s.value).join(' · '),
        products: [exact.code]
      };
    }
    if (exact && /(garantia|garantía|envio|envío)/.test(t)) {
      return { text: productSummary(exact) + '. La garantía depende del fabricante y del producto; el envío se cotiza al confirmar destino. Te comparto la ficha para que revises especificaciones y disponibilidad.', products: [exact.code] };
    }
    if (exact && t.split(/\s+/).length <= 6) {
      return { text: 'Encontré esta coincidencia en el catálogo: ' + productSummary(exact) + '. ¿Quieres que revise el stock, compare con otro modelo o lo agregues al carrito?', products: [exact.code] };
    }

    // Intención de catálogo
    const budget = budgetFrom(text);
    let category = categoryFrom(text);
    const brand = brandFrom(text);
    let use = null;
    if (GAMING_WORDS.test(t)) use = 'gaming';
    else if (DESIGN_WORDS.test(t)) use = 'design';
    else if (CODE_WORDS.test(t)) use = 'code';
    else if (STUDY_WORDS.test(t)) use = 'study';
    if (!category && use) category = 'laptops';
    if (!category && brand) category = null;
    const wantsProducts = category || brand || use || Object.keys(budget).length || /(recomienda|recomiéndame|opciones|modelos|equipos|comprar|busco|necesito)/.test(t);
    if (wantsProducts) {
      const products = recommend({ category, brand, use, max: budget.max, min: budget.min, limit: 3 });
      if (products.length) {
        const parts = [];
        if (budget.max) parts.push('con presupuesto de hasta ' + money(budget.max));
        if (category) parts.push('en ' + ((GALAX.catalog.categories.find((c) => c.slug === category) || {}).name || category));
        if (brand) parts.push('de la marca ' + brand);
        if (use) parts.push(use === 'gaming' ? 'con GPU dedicada registrada' : use === 'design' ? 'con GPU/alta memoria u OLED según ficha' : use === 'code' ? 'con memoria y SSD adecuados según ficha' : 'para estudio y uso general');
        let reply = 'Encontré ' + products.length + ' opción' + (products.length === 1 ? '' : 'es') + ' del catálogo real ' + (parts.length ? parts.join(', ') : '') + '. Te muestro las fichas para que compares especificaciones; el precio y el stock son los registrados en la tienda.';
        if (use === 'gaming') reply += ' No prometo FPS en juegos específicos: verifica la GPU y los requisitos del título.';
        if (use === 'design') reply += ' No prometo compatibilidad con software profesional; revisa los requisitos de tu programa.';
        if (budget.max) reply += ' Si ningún equipo cumple todo lo que buscas, puedo mostrarte alternativas cercanas o derivarte al taller.';
        return { text: reply, products: products.map((p) => p.code) };
      }
      const fallback = recommend({ category, brand, use, limit: 2 });
      if (fallback.length) {
        return { text: 'No encontré una coincidencia exacta con ese presupuesto o combinación. Estas son alternativas reales cercanas del catálogo; confirma stock y precio antes de comprar.', products: fallback.map((p) => p.code) };
      }
      if (budget.max) {
        return { text: 'No hay equipos publicados dentro de ese presupuesto en este momento. El rango del catálogo va de ' + money(GALAX.catalog.meta.priceMin) + ' a ' + money(GALAX.catalog.meta.priceMax) + '. Puedo buscar por marca, uso o mostrarte componentes y periféricos de menor precio.', links: [{ text: 'Ver catálogo completo', url: 'tienda.html' }] };
      }
      return { text: 'No encontré ese producto en el catálogo publicado. No voy a inventar una ficha ni un precio. Puedes revisar el catálogo completo o escribir al equipo para consultar disponibilidad.', links: [{ text: 'Ver catálogo', url: 'tienda.html' }] };
    }

    // Búsqueda libre por tokens
    const tokens = t.split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (tokens.length) {
      const scored = available().map((p) => {
        const hay = normalize([p.name, p.model, p.brand, p.code, p.description].join(' '));
        let score = tokens.reduce((n, token) => n + (hay.includes(token) ? 1 : 0), 0);
        return { p, score };
      }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.p.price - b.p.price).slice(0, 3).map((x) => x.p);
      if (scored.length) {
        return { text: 'Estas son las coincidencias más cercanas en el catálogo real. Si no es lo que buscas, dime marca, presupuesto o uso (estudio, gaming, diseño) para afinar la búsqueda.', products: scored.map((p) => p.code) };
      }
    }
    return { text: 'No encontré ese dato en el catálogo ni en la información confirmada de la tienda. Para no inventar precios, stock o especificaciones, prefiero derivarte con el equipo: escríbenos por WhatsApp o revisa el catálogo. También puedo ayudarte con laptops, computadoras, monitores, componentes, redes, accesorios, servicios técnicos, pagos, envíos y recibos.', links: [{ text: 'Ver catálogo', url: 'tienda.html' }, { text: 'WhatsApp', url: GALAX.whatsappUrl('Hola, necesito ayuda con una consulta que Airi no pudo resolver.') }] };
  }

  /* ------------------------------------------------------------------ */
  /* Gemini/Gemma vía Edge Function (opcional)                          */
  /* ------------------------------------------------------------------ */
  async function cloudAnswer(text) {
    if (!window.GalaxCloud || !GalaxCloud.configured()) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const response = await fetch((GALAX.config.supabase.url || '').replace(/\/$/, '') + '/functions/v1/' + (GALAX.config.functions.aiChat || 'ai-chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: GALAX.config.supabase.anonKey,
          Authorization: 'Bearer ' + GALAX.config.supabase.anonKey
        },
        body: JSON.stringify({ message: text, history: state.history.slice(-6).map((m) => ({ role: m.role, content: m.text })) }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || !data.reply) return null;
      const codes = Array.isArray(data.products) ? data.products.filter((code) => catalogProducts().some((p) => p.code === code)) : [];
      return { text: String(data.reply).slice(0, 2200), products: codes, cloud: true };
    } catch (error) {
      console.warn('[Airi] IA en la nube no disponible; respuesta local:', error.message);
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  function miniProduct(p) {
    return '<div class="airi-product"><img src="' + esc(productImage(p)) + '" alt="" loading="lazy"><div><a href="' + GALAX.productUrl(p) + '"><strong>' + esc(p.name.split(' — ')[0]) + '</strong></a><span>' + money(p.price) + ' · ' + (p.stock > 0 ? 'stock ' + p.stock : 'agotado') + '</span><div class="flex flex-wrap" style="gap:4px;margin-top:4px"><a class="chip" href="' + GALAX.productUrl(p) + '">Ver producto</a><button type="button" data-fav="' + esc(p.code) + '" aria-label="Añadir a favoritos ' + esc(p.name) + '" title="Añadir a favoritos">' + GALAX.icon('heart', 'icon-sm') + '</button><button type="button" data-add-to-cart="' + esc(p.code) + '" aria-label="Agregar ' + esc(p.name) + ' al carrito" title="Agregar al carrito">' + GALAX.icon('cart', 'icon-sm') + ' Añadir</button><button type="button" data-airi-buy="' + esc(p.code) + '" aria-label="Comprar ' + esc(p.name) + '" title="Comprar ahora">' + GALAX.icon('arrowRight', 'icon-sm') + ' Comprar</button></div></div></div>';
  }
  function appendMessage(role, text, codes, options) {
    if (!messagesEl) return;
    const el = document.createElement('div');
    el.className = 'airi-msg ' + role;
    const products = (codes || []).map((code) => catalogProducts().find((p) => p.code === code)).filter(Boolean);
    let html = '';
    if (options && options.image) html += '<img src="' + options.image + '" alt="Imagen adjunta por el usuario" style="max-width:100%;border-radius:8px;margin-bottom:6px;display:block">';
    html += String(text || '').split('\n').map((line) => '<span>' + esc(line) + '</span>').join('<br>');
    if (products.length) html += '<div class="ai-products">' + products.map(miniProduct).join('') + '</div>';
    if (options && options.links && options.links.length) html += '<div class="flex flex-wrap" style="margin-top:7px;gap:5px">' + options.links.map((l) => '<a class="chip" href="' + esc(l.url) + '" ' + (/^https?:/.test(l.url) ? 'target="_blank" rel="noopener"' : '') + '>' + esc(l.text) + '</a>').join('') + '</div>';
    if (role === 'assistant') {
      html += '<div style="display:flex;justify-content:flex-end;margin-top:5px"><button type="button" class="icon-btn" style="width:26px;height:26px" data-speak aria-label="Escuchar respuesta">' + GALAX.icon('volume', 'icon-sm') + '</button></div>';
    }
    el.innerHTML = html;
    el.dataset.plain = String(text || '');
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (role === 'assistant' && state.voiceOut) speak(String(text || ''));
  }
  function showTyping() {
    if (!messagesEl) return null;
    const el = document.createElement('div');
    el.className = 'airi-msg assistant';
    el.innerHTML = '<span class="airi-typing" aria-label="Airi está escribiendo"><i></i><i></i><i></i></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }
  function renderHistory() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    // No se muestra una burbuja de saludo automática: el saludo es por voz + gesto.
    for (const item of state.history.slice(-10)) appendMessage(item.role, item.text, item.codes);
    if (state.image) renderImagePreview();
  }

  async function send(text, image) {
    if (state.busy) return;
    const message = String(text || '').trim();
    if (!message && !image) return;
    state.busy = true;
    if (input) input.value = '';
    appendMessage('user', message || 'Analiza esta imagen, por favor.', [], image ? { image } : {});
    addHistory('user', message || '[imagen]', []);
    const typing = showTyping();
    try {
      let answer;
      if (image) {
        answer = await imageAnswer(message, image);
      } else {
        answer = await cloudAnswer(message);
        if (!answer) answer = localAnswer(message);
      }
      if (typing) typing.remove();
      if (!answer) answer = localAnswer(message);
      appendMessage('assistant', answer.text, answer.products || [], answer);
      addHistory('assistant', answer.text, answer.products || []);
      if (answer.cloud) state.cloudTried = true;
    } catch (error) {
      if (typing) typing.remove();
      const fallback = localAnswer(message);
      appendMessage('assistant', fallback.text, fallback.products || []);
      addHistory('assistant', fallback.text, fallback.products || []);
      console.warn('[Airi]', error);
    } finally {
      state.busy = false;
      state.image = null;
      renderImagePreview();
    }
  }

  async function imageAnswer(prompt, dataUrl) {
    if (!window.GalaxCloud || !GalaxCloud.configured()) {
      return {
        text: 'Recibí la imagen, pero el análisis visual todavía no está desplegado en este entorno. No voy a adivinar qué equipo es ni afirmar un diagnóstico. Puedes enviar la foto por WhatsApp para que una persona la revise; si el servicio de búsqueda visual está configurado, Airi podrá comparar la imagen con el catálogo real e indicar su nivel de certeza.',
        links: [{ text: 'Enviar foto por WhatsApp', url: GALAX.whatsappUrl('Hola, les envío una foto de un equipo para consultar.') }]
      };
    }
    try {
      const data = await GalaxCloud.callFunction(GALAX.config.functions.visualSearch || 'visual-search', {
        image: dataUrl,
        message: prompt || '',
        catalog: catalogProducts().slice(0, 260).map((p) => ({ code: p.code, name: p.name, brand: p.brand, category: p.categoryName }))
      });
      if (!data || !data.reply) throw new Error('Respuesta visual vacía');
      const codes = Array.isArray(data.products) ? data.products.filter((code) => catalogProducts().some((p) => p.code === code)) : [];
      const certainty = data.confidence === 'alta' ? 'coincidencia alta' : data.confidence === 'media' ? 'coincidencia media' : 'coincidencia baja o incierta';
      return {
        text: String(data.reply) + '\n\nNivel de certeza del análisis: ' + certainty + '. Confirma el modelo con una persona antes de comprar.',
        products: codes
      };
    } catch (error) {
      console.warn('[Airi] Búsqueda visual:', error.message);
      return {
        text: 'No pude completar el análisis visual porque el servicio de IA no respondió. No voy a inventar una identificación. Puedes intentar de nuevo o enviar la foto por WhatsApp para revisión humana.',
        links: [{ text: 'Enviar foto por WhatsApp', url: GALAX.whatsappUrl('Hola, les envío una foto de un equipo para consultar.') }]
      };
    }
  }

  function renderImagePreview() {
    if (!imagePreview) return;
    if (!state.image) { imagePreview.innerHTML = ''; imagePreview.hidden = true; return; }
    imagePreview.hidden = false;
    imagePreview.innerHTML = '<img src="' + state.image + '" alt="Vista previa de la imagen adjunta" width="44" height="40"><span>Imagen lista para analizar. Confirma el envío o cámbiala.</span>' +
      '<div style="display:flex;gap:5px">' +
      '<button class="btn btn-soft btn-sm" type="button" data-send-image>Enviar imagen</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-change-image>Cambiar</button>' +
      '<button class="btn btn-danger btn-sm" type="button" data-clear-image>Quitar</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Voz                                                               */
  /* ------------------------------------------------------------------ */
  function setupVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (micBtn) { micBtn.disabled = true; micBtn.title = 'El dictado por voz no está disponible en este navegador'; }
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'es-PE';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => { state.recording = true; micBtn.classList.add('is-recording'); micBtn.setAttribute('aria-label', 'Detener dictado'); };
    rec.onend = () => { state.recording = false; micBtn.classList.remove('is-recording'); micBtn.setAttribute('aria-label', 'Dictar mensaje'); };
    rec.onerror = (event) => {
      state.recording = false;
      micBtn.classList.remove('is-recording');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') GALAX.toast('El navegador bloqueó el micrófono. Revisa los permisos del sitio.', 'error');
      else if (event.error === 'no-speech') GALAX.toast('No se escuchó voz. Intenta de nuevo.', 'info');
      else GALAX.toast('No se pudo usar el micrófono en este navegador.', 'error');
    };
    rec.onresult = (event) => {
      let finalText = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript; else interim += transcript;
      }
      input.value = (finalText || interim).trim();
      if (finalText) {
        setTimeout(() => send(input.value), 250);
      }
    };
    state.recognition = rec;
  }
  function toggleRecognition() {
    if (!state.recognition) { GALAX.toast('El dictado por voz no está disponible en este navegador.', 'info'); return; }
    try {
      if (state.recording) state.recognition.stop();
      else { state.recognition.start(); GALAX.toast('Escuchando… habla ahora.', 'info'); }
    } catch (error) { GALAX.toast('No se pudo iniciar el micrófono.', 'error'); }
  }
  const GREETING = '¡Hola! Bienvenido a GALAX PC REPAIR. Soy Airi y estoy aquí para ayudarte a encontrar tu próxima computadora o componente. ¿Qué estás buscando hoy?';
  const FEMALE_HINTS = ['female','femenina','mujer','woman','girl','female','elvira','dalia','sabina','paloma','camila','monica','paulina','isabela','luciana','sofia','sofía','maria','maría','teresa','clara','aria','jenny','catalina','ximena','salome','salomé','helena','victoria','ines','inés','laura','eva','ana','zoe','zara','valentina','gabriela','carolina','daniela','fernanda','jessica','lucia','lucía','natalia','patricia','rocio','rocío','sara','sandra','silvia','marta','mercedes','beatriz','carmen','diana','elena','esther','ines','irene','isabel','julia','lorena','mónica','raquel','rosa','sara','susana','veronica','verónica'];
  const MALE_HINTS = ['male','masculino','hombre','man','pablo','juan','carlos','diego','miguel','raul','raúl','andres','andrés','jorge','pedro','javier','antonio','alvaro','álvaro','alonso','mateo','enrique','ricardo','david','rodrigo','sergio','nicolas','nicolás','gabriel','arturo','reed','daniel','riccardo','thomas','felix','félix','hans','oskar','oscar','oscar'];
  function selectVoice() {
    const voices = (speechSynthesis.getVoices() || []).filter((v) => /^es/i.test(v.lang));
    if (!voices.length) return null;
    let chosen = null;
    try {
      const savedName = localStorage.getItem('galax_airi_voice_name_v1');
      if (savedName) chosen = voices.find((v) => v.name === savedName);
    } catch {}
    if (!chosen) {
      chosen = voices.find((v) => FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h)));
    }
    if (!chosen) {
      chosen = voices.find((v) => !MALE_HINTS.some((h) => v.name.toLowerCase().includes(h)));
    }
    if (!chosen) chosen = voices[0];
    try { localStorage.setItem('galax_airi_voice_name_v1', chosen.name); } catch {}
    return chosen;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { GALAX.toast('La lectura en voz alta no está disponible en este navegador.', 'info'); return Promise.resolve(false); }
    return new Promise((resolve) => {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text || '').replace(/[\\*_#`]/g, ' '));
      utterance.lang = 'es-PE';
      utterance.rate = 0.98;
      utterance.pitch = 1.05;
      utterance.volume = state.volume != null ? state.volume : 1;
      const voice = selectVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { state.speaking = true; updateVoiceIndicators(true); };
      utterance.onend = () => { state.speaking = false; updateVoiceIndicators(false); resolve(true); };
      utterance.onerror = (e) => { state.speaking = false; updateVoiceIndicators(false); console.warn('[Airi] TTS:', e && e.error); resolve(false); };
      speechSynthesis.speak(utterance);
    });
  }
  function updateVoiceIndicators(speaking) {
    // Actualiza el botón de voz y el estado sin inventar reproducción.
    const btn = document.querySelector('[data-airi-voice]');
    if (btn) {
      btn.setAttribute('aria-pressed', String(state.voiceOut));
      btn.innerHTML = GALAX.icon(speaking ? 'volume' : (state.voiceOut ? 'volume' : 'volumeOff'), 'icon-sm');
    }
    panel && panel.classList.toggle('is-speaking', Boolean(speaking));
  }
  function toggleVoiceOut() {
    state.voiceOut = !state.voiceOut;
    try { localStorage.setItem(VOICE_KEY, state.voiceOut ? '1' : '0'); } catch {}
    if (voiceBtn) {
      voiceBtn.setAttribute('aria-pressed', String(state.voiceOut));
      voiceBtn.innerHTML = GALAX.icon(state.voiceOut ? 'volume' : 'volumeOff', 'icon-sm');
      voiceBtn.title = state.voiceOut ? 'Lectura en voz alta activada' : 'Lectura en voz alta desactivada';
    }
    GALAX.toast(state.voiceOut ? 'Airi leerá sus respuestas en voz alta.' : 'Lectura en voz alta desactivada.', 'info');
  }
  function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      GALAX.toast('La cámara no está disponible en este navegador. Puedes importar una imagen.', 'info');
      return;
    }
    if (cameraPanel) cameraPanel.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        state.cameraStream = stream;
        if (cameraVideo) { cameraVideo.srcObject = stream; cameraVideo.hidden = false; }
        if (cameraCanvas) cameraCanvas.hidden = true;
        if (cameraCapture) cameraCapture.hidden = false;
        if (cameraRetake) cameraRetake.hidden = true;
        if (cameraUse) cameraUse.hidden = true;
      })
      .catch((error) => {
        GALAX.toast('No se pudo acceder a la cámara: ' + (error && error.message ? error.message : 'permiso denegado') + '.', 'error');
        if (cameraPanel) cameraPanel.hidden = true;
      });
  }
  function captureCamera() {
    if (!cameraVideo || !cameraCanvas) return;
    const w = cameraVideo.videoWidth || 640;
    const h = cameraVideo.videoHeight || 480;
    cameraCanvas.width = w;
    cameraCanvas.height = h;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, w, h);
    state.cameraShot = cameraCanvas.toDataURL('image/jpeg', 0.82);
    cameraVideo.hidden = true;
    cameraCanvas.hidden = false;
    if (cameraCapture) cameraCapture.hidden = true;
    if (cameraRetake) cameraRetake.hidden = false;
    if (cameraUse) cameraUse.hidden = false;
  }
  function retakeCamera() {
    state.cameraShot = null;
    if (cameraVideo) cameraVideo.hidden = false;
    if (cameraCanvas) cameraCanvas.hidden = true;
    if (cameraCapture) cameraCapture.hidden = false;
    if (cameraRetake) cameraRetake.hidden = true;
    if (cameraUse) cameraUse.hidden = true;
  }
  function useCameraShot() {
    if (!state.cameraShot) return;
    state.image = state.cameraShot;
    renderImagePreview();
    closeCamera();
    GALAX.toast('Foto capturada. Envíala o cámbiala.', 'info');
  }
  function closeCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
    }
    if (cameraVideo) { cameraVideo.srcObject = null; cameraVideo.hidden = false; }
    if (cameraCanvas) cameraCanvas.hidden = true;
    if (cameraPanel) cameraPanel.hidden = true;
    if (cameraCapture) cameraCapture.hidden = false;
    if (cameraRetake) cameraRetake.hidden = true;
    if (cameraUse) cameraUse.hidden = true;
    state.cameraShot = null;
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                              */
  /* ------------------------------------------------------------------ */
  function markup() {
    const avatar = 'assets/img/optimized/airi.jpg';
    return '<button class="airi-fab" type="button" data-airi-toggle aria-label="Abrir Airi, asistente de GALAX" aria-expanded="false">' +
      '<img src="' + avatar + '" alt="" width="34" height="34"><span>Airi</span><span class="airi-pulse"></span></button>' +
      '<aside class="airi-panel" id="airi-panel" aria-label="Airi, asistente de GALAX PC REPAIR" aria-hidden="true">' +
        '<div class="airi-head"><img class="airi-avatar" src="' + avatar + '" alt="Airi"><div><h2>Airi</h2><p><span class="dot"></span>Asistente del catálogo real</p></div><div class="airi-head-actions"><button class="icon-btn" type="button" data-airi-voice aria-pressed="false" aria-label="Lectura en voz alta" title="Lectura en voz alta">' + GALAX.icon('volumeOff', 'icon-sm') + '</button><button class="icon-btn" type="button" data-airi-clear aria-label="Borrar historial" title="Borrar historial local">' + GALAX.icon('trash', 'icon-sm') + '</button><button class="icon-btn" type="button" data-airi-close aria-label="Cerrar Airi">' + GALAX.icon('close', 'icon-sm') + '</button></div></div>' +
        '<div class="airi-messages" id="airi-messages" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="airi-prompts">' +
          '<button type="button" data-airi-prompt="Laptop para estudiar hasta S/ 3000">Laptop para estudiar</button>' +
          '<button type="button" data-airi-prompt="Equipo para gaming con GPU dedicada">Gaming</button>' +
          '<button type="button" data-airi-prompt="¿Cómo pago con Yape o Plin?">Pagos</button>' +
          '<button type="button" data-airi-prompt="¿Hacen envíos a provincias?">Envíos</button>' +
          '<button type="button" data-airi-prompt="Quiero reparar mi laptop">Reparación</button>' +
        '</div>' +
        '<div class="airi-compose">' +
          '<form class="airi-form" id="airi-form">' +
            '<textarea id="airi-input" rows="1" placeholder="Pregunta por un equipo, presupuesto, stock…" aria-label="Mensaje para Airi"></textarea>' +
            '<button class="icon-btn" type="button" id="airi-import" aria-label="Importar imagen" title="Importar imagen">' + GALAX.icon('image') + '</button>' +
            '<button class="icon-btn" type="button" id="airi-camera" aria-label="Tomar fotografía" title="Tomar fotografía">' + GALAX.icon('camera') + '</button>' +
            '<button class="icon-btn rec-btn" type="button" id="airi-mic" aria-label="Dictar mensaje" title="Dictar mensaje">' + GALAX.icon('mic') + '</button>' +
            '<button class="icon-btn send-btn" type="submit" aria-label="Enviar mensaje">' + GALAX.icon('send') + '</button>' +
          '</form>' +
          '<div id="airi-image-preview" hidden></div>' +
          '<div id="airi-camera-panel" hidden style="margin-top:8px;border:1px solid var(--gx-line);border-radius:10px;padding:8px;background:rgba(0,0,0,.2)">' +
            '<video id="airi-camera-video" autoplay playsinline muted style="width:100%;border-radius:8px;max-height:260px;object-fit:cover"></video>' +
            '<canvas id="airi-camera-canvas" hidden></canvas>' +
            '<div class="flex flex-wrap" style="gap:6px;margin-top:8px">' +
              '<button class="btn btn-soft btn-sm" type="button" id="airi-camera-capture">Capturar</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" id="airi-camera-retake" hidden>Volver a tomar</button>' +
              '<button class="btn btn-primary btn-sm" type="button" id="airi-camera-use" hidden>Usar foto</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" id="airi-camera-close">Cerrar</button>' +
            '</div>' +
            '<p class="tiny dim" style="margin-top:6px">La cámara requiere permiso del navegador. Si no la autorizas, puedes importar una imagen desde el botón de imagen.</p>' +
          '</div>' +
          '<div class="airi-footnote">Airi usa el catálogo real y puede equivocarse. Confirma stock y compatibilidad con el equipo. No compartas datos de tarjeta por chat. <a href="configuracion.html" style="color:var(--gx-cyan)">Privacidad</a>.</div>' +
          '<input type="file" id="airi-file" accept="image/jpeg,image/png,image/webp" hidden>' +
        '</div>' +
      '</aside>';
  }
  function openPanel() {
    if (!panel) return;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    state.open = true;
    const fabEl = document.querySelector('.airi-fab');
    if (fabEl) fabEl.setAttribute('aria-expanded', 'true');
    setTimeout(() => { if (input) input.focus(); }, 120);
    if (!state.ready) {
      state.ready = true;
      renderHistory();
    }
    greetIfNeeded();
  }
  async function greetIfNeeded() {
    let greeted = state.greetingShown;
    try { greeted = greeted || sessionStorage.getItem('galax_airi_greeted_v1') === '1'; } catch {}
    if (greeted) return;
    if (state.history.length) { state.greetingShown = true; try { sessionStorage.setItem('galax_airi_greeted_v1', '1'); } catch {}; return; }
    state.greetingShown = true;
    try { sessionStorage.setItem('galax_airi_greeted_v1', '1'); } catch {}
    const avatar = panel && panel.querySelector('.airi-avatar');
    if (avatar) {
      avatar.classList.add('is-waving');
      setTimeout(() => avatar.classList.remove('is-waving'), 2600);
    }
    if (state.voiceOut || true) {
      // Intenta reproducir; si el navegador bloquea, no simula y ofrece botón.
      const ok = await speak(GREETING);
      if (!ok) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.textContent = 'Escuchar saludo de Airi';
        btn.addEventListener('click', () => { speak(GREETING); btn.remove(); });
        messagesEl && messagesEl.appendChild(btn);
      }
    }
  }
  function closePanel() {
    if (!panel) return;
    closeCamera();
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    state.open = false;
    const fabEl = document.querySelector('.airi-fab');
    if (fabEl) fabEl.setAttribute('aria-expanded', 'false');
  }
  function bind() {
    fab = document.querySelector('.airi-fab');
    panel = document.getElementById('airi-panel');
    messagesEl = document.getElementById('airi-messages');
    form = document.getElementById('airi-form');
    input = document.getElementById('airi-input');
    sendBtn = form && form.querySelector('[type=submit]');
    micBtn = document.getElementById('airi-mic');
    imageInput = document.getElementById('airi-file');
    importBtn = document.getElementById('airi-import');
    cameraBtn = document.getElementById('airi-camera');
    voiceBtn = document.querySelector('[data-airi-voice]');
    imagePreview = document.getElementById('airi-image-preview');
    cameraPanel = document.getElementById('airi-camera-panel');
    cameraVideo = document.getElementById('airi-camera-video');
    cameraCanvas = document.getElementById('airi-camera-canvas');
    cameraCapture = document.getElementById('airi-camera-capture');
    cameraRetake = document.getElementById('airi-camera-retake');
    cameraUse = document.getElementById('airi-camera-use');
    cameraClose = document.getElementById('airi-camera-close');
    fab.addEventListener('click', () => state.open ? closePanel() : openPanel());
    panel.querySelector('[data-airi-close]').addEventListener('click', closePanel);
    panel.querySelector('[data-airi-clear]').addEventListener('click', () => {
      state.history = []; saveHistory(); renderHistory(); GALAX.toast('Historial local de Airi borrado.', 'info');
    });
    if (voiceBtn) voiceBtn.addEventListener('click', toggleVoiceOut);
    if (voiceBtn && state.voiceOut) { voiceBtn.setAttribute('aria-pressed', 'true'); voiceBtn.innerHTML = GALAX.icon('volume', 'icon-sm'); }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.open) closePanel(); });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-airi]')) { event.preventDefault(); openPanel(); }
      const prompt = event.target.closest('[data-airi-prompt]');
      if (prompt) { openPanel(); send(prompt.getAttribute('data-airi-prompt')); }
      const speakBtn = event.target.closest('[data-speak]');
      if (speakBtn) {
        const msg = speakBtn.closest('.airi-msg');
        if (msg && msg.dataset.plain) speak(msg.dataset.plain);
      }
      const clearImg = event.target.closest('[data-clear-image]');
      if (clearImg) { state.image = null; renderImagePreview(); }
      const sendImg = event.target.closest('[data-send-image]');
      if (sendImg) { event.preventDefault(); send(input.value, state.image); return; }
      const changeImg = event.target.closest('[data-change-image]');
      if (changeImg) { event.preventDefault(); imageInput.click(); return; }
      const buyImg = event.target.closest('[data-airi-buy]');
      if (buyImg) {
        event.preventDefault();
        const code = buyImg.getAttribute('data-airi-buy');
        const p = catalogProducts().find((x) => x.code === code);
        if (!p) return;
        if (GALAX.addToCart(code, 1)) location.href = 'checkout.html';
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      send(input.value, state.image);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(input.value, state.image); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
    micBtn.addEventListener('click', toggleRecognition);
    if (importBtn) importBtn.addEventListener('click', () => imageInput.click());
    if (cameraBtn) cameraBtn.addEventListener('click', openCamera);
    if (cameraClose) cameraClose.addEventListener('click', closeCamera);
    if (cameraCapture) cameraCapture.addEventListener('click', captureCamera);
    if (cameraRetake) cameraRetake.addEventListener('click', retakeCamera);
    if (cameraUse) cameraUse.addEventListener('click', useCameraShot);
    imageInput.addEventListener('change', () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;
      const okType = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
      if (!okType) { GALAX.toast('Formato no admitido. Usa JPG, PNG o WEBP.', 'error'); imageInput.value = ''; return; }
      if (file.size > 8 * 1024 * 1024) { GALAX.toast('La imagen debe pesar menos de 8 MB.', 'error'); imageInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => { state.image = reader.result; renderImagePreview(); GALAX.toast('Imagen adjunta. Escribe qué quieres consultar y envía.', 'info'); };
      reader.readAsDataURL(file);
    });
    setupVoice();
    renderHistory();
  }

  function init() {
    if (document.getElementById('airi-panel')) return;
    document.body.insertAdjacentHTML('beforeend', markup());
    bind();
  }
  if (window.GALAX) GALAX.ready().then(init); else document.addEventListener('galax:ready', init, { once: true });
  window.Airi = { open: openPanel, close: closePanel, ask: send, localAnswer };
})();
