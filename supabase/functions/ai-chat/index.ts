import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMMA_URL = Deno.env.get("GEMMA_API_URL") || "";
const GEMMA_KEY = Deno.env.get("GEMMA_API_KEY") || "";
const GEMMA_MODEL = Deno.env.get("GEMMA_MODEL") || "gemma";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  if (!message) return json({ error: "empty_message" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: products, error } = await supabase
    .from("productos")
    .select("codigo,nombre,marca,modelo,precio_venta,precio_oferta,stock,publicado,estado,categorias(nombre,slug),especificaciones")
    .eq("estado", "activo").eq("publicado", 1).limit(300);
  if (error) return json({ error: "catalog_unavailable", detail: error.message }, 503);

  const catalog = (products || []).map((p: any) => ({
    code: p.codigo,
    name: p.nombre,
    brand: p.marca,
    category: p.categorias?.nombre,
    price: p.precio_oferta ?? p.precio_venta,
    stock: p.stock,
  }));

  if (!GEMMA_URL || !GEMMA_KEY) {
    return json({ error: "gemma_not_configured", detail: "Configura GEMMA_API_URL y GEMMA_API_KEY en los secretos de la Edge Function." }, 503);
  }

  const system = `Eres Airi, asistente de GALAX PC REPAIR. Responde en español peruano, tono profesional y cálido. Usa SOLO los productos del catálogo JSON proporcionado. Nunca inventes productos, precios, stock ni enlaces. Si recomiendas productos, devuelve sus códigos exactos en el campo "products". Si no hay coincidencia, dilo. Catálogo: ${JSON.stringify(catalog)}`;

  const upstream = await fetch(GEMMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMMA_KEY}` },
    body: JSON.stringify({
      model: GEMMA_MODEL,
      messages: [
        { role: "system", content: system },
        ...(Array.isArray(body?.history) ? body.history.slice(-6) : []),
        { role: "user", content: message },
      ],
      temperature: 0.2,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: "gemma_unavailable", detail: detail.slice(0, 500) }, 502);
  }
  const data = await upstream.json();
  const reply = data?.choices?.[0]?.message?.content || data?.reply || "";
  // Extraer códigos válidos mencionados.
  const validCodes = new Set(catalog.map((p) => p.code));
  const mentioned = (reply.match(/\b[A-Z]{2,4}-\d{2,4}\b/g) || []).filter((c: string) => validCodes.has(c));
  const productsField = Array.isArray(body?.products) ? body.products.filter((c: string) => validCodes.has(c)) : mentioned;
  return json({ reply: String(reply).slice(0, 2200), products: Array.from(new Set(productsField)).slice(0, 5) });
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", ...cors() } });
}
