import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VISION_URL = Deno.env.get("VISION_API_URL") || "";
const VISION_KEY = Deno.env.get("VISION_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const image = String(body?.image || "");
  if (!image.startsWith("data:image/")) return json({ error: "invalid_image" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: products, error } = await supabase
    .from("productos").select("codigo,nombre,marca,modelo,precio_venta,precio_oferta,stock,publicado,estado,categorias(nombre,slug)")
    .eq("estado","activo").eq("publicado",1).limit(300);
  if (error) return json({ error: "catalog_unavailable", detail: error.message }, 503);

  const catalog = (products || []).map((p:any) => ({ code: p.codigo, name: p.nombre, brand: p.marca, category: p.categorias?.nombre, price: p.precio_oferta ?? p.precio_venta, stock: p.stock }));

  if (!VISION_URL || !VISION_KEY) {
    return json({ error: "vision_not_configured", detail: "Configura VISION_API_URL y VISION_API_KEY. No se realiza ninguna identificación sin servicio real.", reply: "El análisis visual no está desplegado en este entorno. No voy a adivinar el equipo. Puedes enviar la foto por WhatsApp para revisión humana.", products: [], confidence: "baja" }, 503);
  }

  const upstream = await fetch(VISION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${VISION_KEY}` },
    body: JSON.stringify({ image, catalog, message: body?.message || "" }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(()=> "");
    return json({ error: "vision_unavailable", detail: detail.slice(0,500), reply: "No pude completar el análisis visual porque el servicio no respondió. No invento identificaciones.", products: [], confidence: "baja" }, 502);
  }
  const data = await upstream.json();
  const valid = new Set(catalog.map((p:any)=>p.code));
  const codes = Array.isArray(data?.products) ? data.products.filter((c:string)=>valid.has(c)) : [];
  return json({
    reply: String(data?.reply || "Coincidencias aproximadas del catálogo real. Confirma el modelo antes de comprar.").slice(0,2200),
    products: codes.slice(0,6),
    confidence: ["alta","media","baja"].includes(data?.confidence) ? data.confidence : "baja",
  });
});

function cors(){ return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}; }
function json(payload:unknown,status=200){ return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json",...cors()}}); }
