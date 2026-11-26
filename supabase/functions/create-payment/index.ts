import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CULQI_PRIVATE = Deno.env.get("CULQI_PRIVATE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!CULQI_PRIVATE) return json({ error: "culqi_not_configured", detail: "Falta CULQI_PRIVATE_KEY. No se realiza ningún cobro." }, 503);

  const body = await req.json().catch(()=>({}));
  const orderId = Number(body?.orderId);
  if (!orderId) return json({ error: "invalid_order" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: order, error } = await supabase.from("store_orders").select("id,code,total,payment_method,payment_status,status").eq("id", orderId).maybeSingle();
  if (error || !order) return json({ error: "order_not_found" }, 404);
  if (order.payment_status === "paid") return json({ error: "already_paid" }, 409);

  const chargeRes = await fetch("https://api.culqi.com/v2/charges", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CULQI_PRIVATE}` },
    body: JSON.stringify({
      amount: Math.round(Number(order.total) * 100),
      currency_code: "PEN",
      email: body?.email || undefined,
      source_id: body?.sourceId,
      description: `Pedido ${order.code} GALAX PC REPAIR`,
      metadata: { order_id: order.id, order_code: order.code },
    }),
  });
  const charge = await chargeRes.json().catch(()=>({}));
  if (!chargeRes.ok || charge?.object === "error") {
    return json({ error: "charge_failed", detail: charge?.user_message || charge?.merchant_message || "Cobro rechazado." }, 402);
  }

  // No marcar pagado aquí: se confirma por webhook firmado.
  await supabase.from("store_orders").update({ payment_status: "pending", updated_at: new Date().toISOString() }).eq("id", order.id);
  return json({ ok: true, chargeId: charge.id, status: "pending_confirmation" });
});

function cors(){ return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}; }
function json(payload:unknown,status=200){ return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json",...cors()}}); }
